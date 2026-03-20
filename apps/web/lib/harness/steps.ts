import { generateText, stepCountIs } from "ai"
import { tool } from "ai"
import { z } from "zod"
import { getHarnessMessages, saveHarnessMessages } from "@workspace/db/queries/harness-messages"
import { searchArtifacts, getArtifactById, getNextArtifactVersion, createArtifact } from "@workspace/db/queries/artifacts"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { updateAgentRunStatus, saveMessages } from "@workspace/db/queries/agent-runs"
import { updateContentStage } from "@workspace/db/queries/content"
import { resolveModel } from "../agents/resolve-model"
import {
  handleRunAgent,
  handleGetContentStatus,
  handleSearchArtifacts,
} from "./tool-handlers"
import { getBuiltInAgent } from "../agents/built-in/registry"
import type { ContentContext, ArtifactSummary } from "./types"
import type { ArtifactStatus } from "@workspace/db"
import type { CompatibleLanguageModel } from "@workflow/ai/agent"

// ---------------------------------------------------------------------------
// Load conversation history
// ---------------------------------------------------------------------------

export async function loadConversationStep(
  contentId: string,
  limit: number,
) {
  "use step"

  const { messages } = await getHarnessMessages(contentId, { limit })
  // Messages come back newest-first; reverse for chronological order
  return messages.reverse()
}

// ---------------------------------------------------------------------------
// Build dynamic system context
// ---------------------------------------------------------------------------

export async function buildContextStep(ctx: ContentContext) {
  "use step"

  const contentRow = await getContentByIdOnly(ctx.contentId)
  const artifacts = await searchArtifacts({
    organizationId: ctx.organizationId,
    contentId: ctx.contentId,
  })

  const artifactSummary = artifacts.length > 0
    ? artifacts
        .map((a) => `- ${a.type} v${a.version}: "${a.title}" (${a.status})`)
        .join("\n")
    : "No artifacts yet."

  return `
Current content: "${contentRow?.title ?? ctx.contentTitle}"
Stage: ${contentRow?.currentStageId ?? ctx.contentStage}
Artifacts:
${artifactSummary}`
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

export function createHarnessModelStepFn(
  organizationId: string,
): () => Promise<CompatibleLanguageModel> {
  return async () => {
    "use step"
    const model = await resolveModel(null, organizationId)
    return model as unknown as CompatibleLanguageModel
  }
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
  }>,
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
      type: z.string().describe('Artifact type, e.g. "research-notes", "blog-draft"'),
      title: z.string().describe("A short title for the artifact"),
      data: z.record(z.string(), z.unknown()).describe("The artifact payload as a JSON object."),
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
        agentId: input.agentId,
        runId: input.runId,
        type,
        title,
        data,
        version,
        parentIds,
      })
      if (type === "blog-draft" && input.contentId) {
        await updateContentStage(input.contentId, "draft", input.organizationId)
      }
      return { artifactId: artifact.id, type: artifact.type, version: artifact.version }
    },
  })

  tools["load-artifact"] = tool({
    description: "Load a previously saved artifact by its ID.",
    inputSchema: z.object({
      artifactId: z.string().describe("The artifact ID to load"),
    }),
    execute: async ({ artifactId }: { artifactId: string }) => {
      const artifact = await getArtifactById(artifactId)
      if (!artifact || artifact.organizationId !== input.organizationId || artifact.contentId !== input.contentId) {
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
    execute: async ({ type, status }: {
      type?: string; status?: string
    }) => {
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
          const data: any = await response.json()
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results: (data.results ?? []).map((r: any) => ({
              title: r.title, url: r.url, snippet: r.text?.slice(0, 500),
            })),
          }
        },
      })
    }
  }

  const result = await generateText({
    model,
    system: input.agentPrompt,
    messages: [{ role: "user", content: "Execute the task as instructed in your system prompt." }],
    tools,
    stopWhen: stepCountIs(15),
  })

  // Collect artifacts created during this run
  const createdArtifacts = await searchArtifacts({
    organizationId: input.organizationId,
    runId: input.runId,
  })

  // Save sub-agent messages for observability
  const newMsgs = result.response.messages.map((m, i) => ({
    id: `${input.runId}-msg-${i}`,
    role: m.role as "user" | "assistant" | "system" | "tool",
    parts: JSON.stringify("content" in m ? m.content : null),
    metadata: undefined,
  }))
  if (newMsgs.length > 0) {
    await saveMessages(input.runId, newMsgs)
  }
  await updateAgentRunStatus(input.runId, "completed", { completedAt: new Date() })

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

export async function runAgentStep(input: {
  agentId: string
  instructions: string
  organizationId: string
  projectId: string
  contentId: string
  createdBy: string
}) {
  "use step"
  return handleRunAgent(input)
}

export async function getContentStatusStep(ctx: ContentContext) {
  "use step"
  return handleGetContentStatus(ctx)
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

export async function getAgentDescriptionsStep(agentIds: string[]) {
  "use step"
  return agentIds
    .map((id) => {
      const agent = getBuiltInAgent(id)
      return agent ? `- ${id}: ${agent.description}` : `- ${id}`
    })
    .join("\n")
}
