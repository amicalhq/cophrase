import { generateText, stepCountIs } from "ai"
import { tool } from "ai"
import { z } from "zod"
import {
  getHarnessMessages,
  saveHarnessMessages,
} from "@workspace/db/queries/harness-messages"
import {
  searchArtifacts,
  getArtifactById,
  getNextArtifactVersion,
  createArtifact,
} from "@workspace/db/queries/artifacts"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import {
  updateAgentRunStatus,
  saveMessages,
} from "@workspace/db/queries/agent-runs"
import { resolveModel, getModelMeta, type ResolvedModelMeta } from "@/lib/agents/resolve-model"
import {
  handleGetContentStatus,
  handleSearchArtifacts,
} from "./tool-handlers"
import type { ContentContext, ArtifactSummary, DynamicHarnessConfig } from "./types"
import type { ArtifactStatus } from "@workspace/db"
import type { CompatibleLanguageModel } from "@workflow/ai/agent"

// ---------------------------------------------------------------------------
// Load conversation history
// ---------------------------------------------------------------------------

export async function loadConversationStep(contentId: string, limit: number) {
  "use step"

  const { messages } = await getHarnessMessages(contentId, { limit })
  // Messages come back newest-first; reverse for chronological order
  return messages.reverse()
}

// ---------------------------------------------------------------------------
// Build dynamic system context
// ---------------------------------------------------------------------------

export async function loadHarnessConfigStep(contentTypeId: string) {
  "use step"
  const { getHarnessConfig } = await import(
    "@workspace/db/queries/content-types"
  )
  return getHarnessConfig(contentTypeId)
}

export async function buildContextStep(
  ctx: ContentContext,
  config: DynamicHarnessConfig,
) {
  "use step"

  const contentRow = await getContentByIdOnly(ctx.contentId)
  const artifacts = await searchArtifacts({
    organizationId: ctx.organizationId,
    contentId: ctx.contentId,
  })

  // Determine stage completion: check for completed agent runs per sub-agent
  const { getCompletedRunsByAgentIds } = await import(
    "@workspace/db/queries/agent-runs"
  )
  const allSubAgentIds = config.stages.flatMap((s) =>
    s.subAgents.map((sa) => sa.agentId),
  )
  const completedRuns =
    allSubAgentIds.length > 0
      ? await getCompletedRunsByAgentIds(allSubAgentIds, ctx.contentId)
      : new Set<string>()

  const currentStageId = contentRow?.currentStageId ?? null

  // Build pipeline view
  const pipelineLines = config.stages.map((s) => {
    const allDone =
      s.subAgents.length > 0 &&
      s.subAgents.every((sa) => completedRuns.has(sa.agentId))
    const isCurrent = s.id === currentStageId
    const status = allDone ? "completed" : isCurrent ? "current" : "pending"
    const subAgentNames = s.subAgents.map((sa) => sa.name).join(", ")
    return `  ${s.position}. ${s.name} [${status}]${s.optional ? " (optional)" : ""} — Sub-agents: ${subAgentNames || "none"}`
  })

  const currentStage = config.stages.find((s) => s.id === currentStageId)

  const artifactSummary =
    artifacts.length > 0
      ? artifacts
          .map((a) => `- "${a.title}" [${a.type} v${a.version}, ${a.status}] (id: ${a.id})`)
          .join("\n")
      : "No artifacts yet."

  return `
Current content: "${contentRow?.title ?? ctx.contentTitle}"
Content type: ${config.contentTypeName}

Pipeline:
${pipelineLines.join("\n")}

Current stage: ${currentStage ? `${currentStage.position}/${config.stages.length} (${currentStage.name})` : "Not started"}

Artifacts:
${artifactSummary}

Available stages you can run:
${config.stages
  .map(
    (s) =>
      `- run-stage(stageId: "${s.id}", stageName: "${s.name}", agentNames: [${s.subAgents.map((sa) => `"${sa.name}"`).join(", ")}]) → ${s.name} (${s.subAgents.map((sa) => sa.name).join(", ") || "no sub-agents"})`,
  )
  .join("\n")}`
}

// ---------------------------------------------------------------------------
// Sub-agent user message builder
// ---------------------------------------------------------------------------

function buildSubAgentUserMessage(
  contentTypeName: string,
  contentTitle: string,
  artifactRefs?: Array<{ id: string; title: string; type: string; version: number }>
): string {
  let msg = `Execute your task for a ${contentTypeName} about: "${contentTitle}".`
  if (artifactRefs && artifactRefs.length > 0) {
    const list = artifactRefs
      .map((a) => `"${a.title}" (${a.type} v${a.version}, id: ${a.id})`)
      .join(", ")
    msg += `\n\nUse load-artifact to load these artifacts from previous stages as input: ${list}`
  }
  msg +=
    "\n\nUse your tools to complete the work and save the results as an artifact."
  return msg
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

export function createHarnessModelStepFn(
  organizationId: string,
  userSelectedModelId?: string | null
): () => Promise<CompatibleLanguageModel> {
  return async () => {
    "use step"
    const model = await resolveModel(userSelectedModelId ?? null, organizationId)
    return model as unknown as CompatibleLanguageModel
  }
}

export async function resolveModelMetaStep(
  organizationId: string,
  modelId?: string | null
): Promise<ResolvedModelMeta> {
  "use step"
  return await getModelMeta(modelId ?? null, organizationId)
}

// ---------------------------------------------------------------------------
// Persist harness messages
// ---------------------------------------------------------------------------

export async function persistHarnessMessages(
  messages: Array<{
    organizationId: string
    contentId: string
    role: "user" | "assistant" | "system" | "tool"
    parts: unknown
    metadata?: unknown
    modelRecordId?: string | null
    providerRecordId?: string | null
    modelProviderType?: string | null
    modelName?: string | null
  }>
) {
  "use step"
  if (messages.length === 0) return
  await saveHarnessMessages(messages)
}

// ---------------------------------------------------------------------------
// Sub-agent inline execution (used by run-agent tool handler)
// ---------------------------------------------------------------------------

export async function runSubAgentInline(input: {
  agentPrompt: string
  agentModelId: string | null
  organizationId: string
  projectId: string
  contentId: string
  agentId: string
  runId: string
  toolRecords: Array<{ type: string; referenceId: string }>
}): Promise<{ artifacts: ArtifactSummary[] }> {
  "use step"

  const model = await resolveModel(input.agentModelId, input.organizationId)

  // Build sub-agent tools (artifact CRUD + function tools)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {}

  tools["save-artifact"] = tool({
    description: "Save an artifact to the database.",
    inputSchema: z.object({
      type: z
        .string()
        .describe('Artifact type, e.g. "research-notes", "blog-draft"'),
      title: z.string().describe("A short title for the artifact"),
      data: z
        .record(z.string(), z.unknown())
        .describe(
          "The artifact payload. MUST include a 'markdown' field with the full content as well-formatted markdown. " +
            "Example: { markdown: '# Title\\n\\nContent with **bold**, lists, etc.', ...optional structured metadata }"
        ),
      parentIds: z
        .array(z.string())
        .optional()
        .describe("IDs of parent artifacts"),
    }),
    execute: async ({
      type,
      title,
      data,
      parentIds,
    }: {
      type: string
      title: string
      data: Record<string, unknown>
      parentIds?: string[]
    }) => {
      const version = await getNextArtifactVersion(input.contentId, type)
      const artifact = await createArtifact({
        organizationId: input.organizationId,
        projectId: input.projectId,
        contentId: input.contentId,
        agentId: input.agentId,
        runId: input.runId,
        type,
        title,
        data,
        version,
        parentIds,
      })
      return {
        artifactId: artifact.id,
        type: artifact.type,
        version: artifact.version,
      }
    },
  })

  tools["load-artifact"] = tool({
    description: "Load a previously saved artifact by its ID.",
    inputSchema: z.object({
      artifactId: z.string().describe("The artifact ID to load"),
    }),
    execute: async ({ artifactId }: { artifactId: string }) => {
      const artifact = await getArtifactById(artifactId)
      if (
        !artifact ||
        artifact.organizationId !== input.organizationId ||
        artifact.contentId !== input.contentId
      ) {
        return { error: "Artifact not found" }
      }
      return {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        data: artifact.data,
        version: artifact.version,
        status: artifact.status,
      }
    },
  })

  tools["search-artifacts"] = tool({
    description: "Search for existing artifacts.",
    inputSchema: z.object({
      type: z.string().optional(),
      status: z.enum(["pending", "ready", "approved", "rejected"]).optional(),
    }),
    execute: async ({ type, status }: { type?: string; status?: string }) => {
      const results = await searchArtifacts({
        organizationId: input.organizationId,
        contentId: input.contentId,
        type,
        status: status as ArtifactStatus | undefined,
      })
      return { count: results.length, artifacts: results }
    },
  })

  // Add web-search if available
  for (const record of input.toolRecords) {
    if (record.type === "function" && record.referenceId === "web-search") {
      tools["web-search"] = tool({
        description: "Search the web for information on a topic.",
        inputSchema: z.object({
          query: z.string().describe("The search query"),
          numResults: z.number().min(1).max(10).optional(),
        }),
        execute: async ({
          query,
          numResults = 5,
        }: {
          query: string
          numResults?: number
        }) => {
          const apiKey = process.env.EXA_API_KEY
          if (!apiKey) throw new Error("EXA_API_KEY is not configured")
          const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              query,
              numResults,
              type: "auto",
              contents: { text: { maxCharacters: 2000 } },
            }),
          })
          if (!response.ok)
            throw new Error(
              `Exa API error: ${response.status} ${response.statusText}`
            )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any = await response.json()
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results: (data.results ?? []).map((r: any) => ({
              title: r.title,
              url: r.url,
              snippet: r.text?.slice(0, 500),
            })),
          }
        },
      })
    }
  }

  const result = await generateText({
    model,
    system: input.agentPrompt,
    messages: [
      {
        role: "user",
        content: "Execute the task as instructed in your system prompt.",
      },
    ],
    tools,
    stopWhen: stepCountIs(15),
  })

  // Collect artifacts created during this run
  const createdArtifacts = await searchArtifacts({
    organizationId: input.organizationId,
    runId: input.runId,
  })

  // Save sub-agent messages for observability
  const newMsgs = result.response.messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system" | "tool",
    parts: JSON.stringify("content" in m ? m.content : null),
    metadata: undefined,
  }))
  if (newMsgs.length > 0) {
    await saveMessages(input.runId, newMsgs)
  }
  await updateAgentRunStatus(input.runId, "completed", {
    completedAt: new Date(),
  })

  return {
    artifacts: createdArtifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      version: a.version,
      status: a.status,
    })),
  }
}

// ---------------------------------------------------------------------------
// Step wrappers for harness tool handlers
// (DB access must happen inside step functions, not in the workflow bundle)
// ---------------------------------------------------------------------------

export async function runStageStep(input: {
  stageId: string
  artifactIds?: string[]
  config: DynamicHarnessConfig
  organizationId: string
  projectId: string
  contentId: string
  createdBy: string
}) {
  "use step"

  // Inline handleRunStage logic here to avoid nested "use step" calls.
  // handleRunStage calls runSubAgentInline (which has "use step"), causing
  // a nested step problem. By inlining, we keep everything in one step.
  const { getAgentTools } = await import("@workspace/db/queries/agents")
  const { createAgentRun, updateAgentRunStatus } = await import(
    "@workspace/db/queries/agent-runs"
  )
  const { updateContentStage, getContentByIdOnly } = await import(
    "@workspace/db/queries/content"
  )

  // Get content title for sub-agent context
  const contentRow = await getContentByIdOnly(input.contentId)
  const contentTitle = contentRow?.title ?? "Untitled"

  const stage = input.config.stages.find((s) => s.id === input.stageId)
  if (!stage) {
    return {
      success: false,
      stageName: "unknown",
      artifacts: [] as ArtifactSummary[],
      subAgentResults: [] as Array<{
        agentName: string
        success: boolean
        artifacts: ArtifactSummary[]
        error?: string
      }>,
      error: `Stage ${input.stageId} not found in content type`,
    }
  }

  if (stage.subAgents.length === 0) {
    return {
      success: false,
      stageName: stage.name,
      artifacts: [] as ArtifactSummary[],
      subAgentResults: [] as Array<{
        agentName: string
        success: boolean
        artifacts: ArtifactSummary[]
        error?: string
      }>,
      error: `Stage "${stage.name}" has no sub-agents configured`,
    }
  }

  // Resolve artifact IDs to descriptive refs for sub-agent context
  const artifactRefs: Array<{ id: string; title: string; type: string; version: number }> = []
  if (input.artifactIds && input.artifactIds.length > 0) {
    for (const id of input.artifactIds) {
      const a = await getArtifactById(id)
      if (a) artifactRefs.push({ id: a.id, title: a.title, type: a.type, version: a.version })
    }
  }

  const allArtifacts: ArtifactSummary[] = []
  const subAgentResults: Array<{
    agentName: string
    success: boolean
    artifacts: ArtifactSummary[]
    error?: string
    durationMs?: number
    reasoningText?: string
    text?: string
  }> = []

  for (const sa of stage.subAgents) {
    const toolRecords = await getAgentTools(sa.agentId)

    const run = await createAgentRun({
      organizationId: input.organizationId,
      projectId: input.projectId,
      contentId: input.contentId,
      agentId: sa.agentId,
      createdBy: input.createdBy,
      executionMode: "auto",
    })

    try {
      // Inline sub-agent execution (same as runSubAgentInline but without "use step")
      const model = await resolveModel(sa.modelId, input.organizationId)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subTools: Record<string, any> = {}

      subTools["save-artifact"] = tool({
        description: "Save an artifact to the database.",
        inputSchema: z.object({
          type: z.string().describe('Artifact type, e.g. "research-notes", "blog-draft"'),
          title: z.string().describe("A short title for the artifact"),
          data: z
            .record(z.string(), z.unknown())
            .describe(
              "The artifact payload. MUST include a 'markdown' field with the full content as well-formatted markdown. " +
                "Example: { markdown: '# Title\\n\\nContent with **bold**, lists, etc.', ...optional structured metadata }"
            ),
          parentIds: z.array(z.string()).optional().describe("IDs of parent artifacts"),
        }),
        execute: async ({ type, title, data, parentIds }: {
          type: string; title: string; data: Record<string, unknown>; parentIds?: string[]
        }) => {
          const version = await getNextArtifactVersion(input.contentId, type)
          const artifact = await createArtifact({
            organizationId: input.organizationId,
            projectId: input.projectId,
            contentId: input.contentId,
            agentId: sa.agentId,
            runId: run.id,
            type, title, data, version, parentIds,
          })
          return { artifactId: artifact.id, type: artifact.type, version: artifact.version }
        },
      })

      subTools["load-artifact"] = tool({
        description: "Load a previously saved artifact by its ID.",
        inputSchema: z.object({ artifactId: z.string().describe("The artifact ID to load") }),
        execute: async ({ artifactId }: { artifactId: string }) => {
          const artifact = await getArtifactById(artifactId)
          if (!artifact || artifact.organizationId !== input.organizationId || artifact.contentId !== input.contentId) {
            return { error: "Artifact not found" }
          }
          return { id: artifact.id, type: artifact.type, title: artifact.title, data: artifact.data, version: artifact.version, status: artifact.status }
        },
      })

      subTools["search-artifacts"] = tool({
        description: "Search for existing artifacts.",
        inputSchema: z.object({
          type: z.string().optional(),
          status: z.enum(["pending", "ready", "approved", "rejected"]).optional(),
        }),
        execute: async ({ type, status }: { type?: string; status?: string }) => {
          const results = await searchArtifacts({
            organizationId: input.organizationId,
            contentId: input.contentId,
            type,
            status: status as ArtifactStatus | undefined,
          })
          return { count: results.length, artifacts: results }
        },
      })

      for (const record of toolRecords) {
        if (record.type === "function" && record.referenceId === "web-search") {
          subTools["web-search"] = tool({
            description: "Search the web for information on a topic.",
            inputSchema: z.object({
              query: z.string().describe("The search query"),
              numResults: z.number().min(1).max(10).optional(),
            }),
            execute: async ({ query, numResults = 5 }: { query: string; numResults?: number }) => {
              const apiKey = process.env.EXA_API_KEY
              if (!apiKey) throw new Error("EXA_API_KEY is not configured")
              const response = await fetch("https://api.exa.ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ query, numResults, type: "auto", contents: { text: { maxCharacters: 2000 } } }),
              })
              if (!response.ok) throw new Error(`Exa API error: ${response.status} ${response.statusText}`)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const resData: any = await response.json()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return { results: (resData.results ?? []).map((r: any) => ({ title: r.title, url: r.url, snippet: r.text?.slice(0, 500) })) }
            },
          })
        }
      }

      const startMs = Date.now()
      const result = await generateText({
        model,
        system: sa.prompt,
        messages: [{ role: "user" as const, content: buildSubAgentUserMessage(input.config.contentTypeName, contentTitle, artifactRefs.length > 0 ? artifactRefs : undefined) }],
        tools: subTools,
        stopWhen: stepCountIs(15),
      })
      const durationMs = Date.now() - startMs

      const createdArtifacts = await searchArtifacts({
        organizationId: input.organizationId,
        runId: run.id,
      })

      const newMsgs = result.response.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system" | "tool",
        parts: JSON.stringify("content" in m ? m.content : null),
        metadata: undefined,
      }))
      if (newMsgs.length > 0) {
        await saveMessages(run.id, newMsgs)
      }
      await updateAgentRunStatus(run.id, "completed", { completedAt: new Date() })

      const artifacts = createdArtifacts.map((a) => ({
        id: a.id, type: a.type, title: a.title, version: a.version, status: a.status,
      }))
      allArtifacts.push(...artifacts)
      subAgentResults.push({
        agentName: sa.name,
        success: true,
        artifacts,
        durationMs,
        reasoningText: result.reasoningText ?? undefined,
        text: result.text || undefined,
      })
    } catch (err) {
      await updateAgentRunStatus(run.id, "failed", {
        error: { code: "AGENT_ERROR", message: err instanceof Error ? err.message : String(err) },
      }).catch(console.error)
      subAgentResults.push({
        agentName: sa.name, success: false, artifacts: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const allSucceeded = subAgentResults.every((r) => r.success)
  if (allSucceeded) {
    const nextStage = input.config.stages.find((s) => s.position === stage.position + 1)
    await updateContentStage(input.contentId, nextStage?.id ?? null, input.organizationId)
  }

  return {
    success: allSucceeded,
    stageName: stage.name,
    artifacts: allArtifacts,
    subAgentResults,
    error: allSucceeded ? undefined : "Some sub-agents failed — stage was not advanced.",
  }
}

export async function getContentStatusStep(
  ctx: ContentContext,
  config: DynamicHarnessConfig,
) {
  "use step"
  return handleGetContentStatus(ctx, config)
}

export async function searchArtifactsStep(input: {
  organizationId: string
  contentId: string
  type?: string
  status?: string
}) {
  "use step"
  return handleSearchArtifacts(input)
}
