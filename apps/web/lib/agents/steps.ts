/**
 * Step functions for durable agent workflows.
 *
 * Each function uses "use step" — they run in a separate worker with
 * full Node.js access, automatic retries, and observability.
 *
 * This file is separate from run-agent.ts because the Workflow compiler
 * bundles workflow functions without Node.js modules. Step functions with
 * DB/crypto dependencies must live in their own file.
 */

import { generateText, stepCountIs } from "ai"
import { tool } from "ai"
import { z } from "zod"
import {
  createArtifact,
  getArtifactById,
  getNextArtifactVersion,
  searchArtifacts as searchArtifactsQuery,
} from "@workspace/db/queries/artifacts"
import {
  updateAgentRunStatus,
  saveMessages,
} from "@workspace/db/queries/agent-runs"
import { updateContentStage } from "@workspace/db/queries/content"
import {
  getModelById,
  getDefaultsForOrg,
} from "@workspace/db/queries/models"
import { getProviderById } from "@workspace/db/queries/providers"
import { decrypt } from "@workspace/db/crypto"
import { resolveModel } from "./resolve-model"
import { getBuiltInAgent, getBuiltInAgentTools } from "./built-in/registry"
import type { ArtifactStatus } from "@workspace/db"
import type { CompatibleLanguageModel } from "@workflow/ai/agent"

// ---------------------------------------------------------------------------
// Model resolution step
// ---------------------------------------------------------------------------

/**
 * Returns a step function compatible with DurableAgent's model parameter.
 *
 * Closes over serializable strings only (modelId, organizationId).
 * DB access + model creation happens inside the "use step" boundary,
 * avoiding both closure serialization issues and AI Gateway dependency.
 */
export function createModelStepFn(
  modelId: string | null,
  organizationId: string,
): () => Promise<CompatibleLanguageModel> {
  return async () => {
    "use step"

    let resolvedModelId = modelId

    if (!resolvedModelId) {
      const defaults = await getDefaultsForOrg(organizationId)
      const defaultLM = defaults.find((d) => d.modelType === "language")
      if (!defaultLM) {
        throw new Error(
          `No default language model configured for org ${organizationId}. ` +
            `Please set a default model in Settings > Models.`,
        )
      }
      resolvedModelId = defaultLM.modelId
    }

    const model = await getModelById(resolvedModelId)
    if (!model) throw new Error(`Model not found: ${resolvedModelId}`)

    const provider = await getProviderById(model.providerId, organizationId)
    if (!provider) {
      throw new Error(
        `Provider not found: ${model.providerId} for org ${organizationId}`,
      )
    }

    const apiKey = decrypt(provider.apiKeyEnc)
    const opts = {
      apiKey,
      ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    }

    switch (provider.providerType) {
      case "openai": {
        const { createOpenAI } = await import("@ai-sdk/openai")
        return createOpenAI(opts)(
          model.modelId,
        ) as unknown as CompatibleLanguageModel
      }
      case "groq": {
        const { createGroq } = await import("@ai-sdk/groq")
        return createGroq(opts)(
          model.modelId,
        ) as unknown as CompatibleLanguageModel
      }
      default:
        throw new Error(
          `Unsupported provider type: ${provider.providerType}`,
        )
    }
  }
}

// ---------------------------------------------------------------------------
// Artifact steps
// ---------------------------------------------------------------------------

export async function saveArtifactStep(input: {
  type: string
  title: string
  data: unknown
  parentIds?: string[]
  organizationId: string
  projectId: string
  contentId?: string
  agentId: string
  runId: string
}): Promise<{ artifactId: string; type: string; version: number }> {
  "use step"

  const version = input.contentId
    ? await getNextArtifactVersion(input.contentId, input.type)
    : 1

  const artifact = await createArtifact({
    organizationId: input.organizationId,
    projectId: input.projectId,
    contentId: input.contentId,
    agentId: input.agentId,
    runId: input.runId,
    type: input.type,
    title: input.title,
    data: input.data,
    version,
    parentIds: input.parentIds,
  })

  if (input.type === "blog-draft" && input.contentId) {
    await updateContentStage(input.contentId, "draft", input.organizationId)
  }

  return {
    artifactId: artifact.id,
    type: artifact.type,
    version: artifact.version,
  }
}

export async function loadArtifactStep(input: {
  artifactId: string
  organizationId: string
}): Promise<
  | {
      id: string
      type: string
      title: string
      data: unknown
      version: number
      status: string
    }
  | { error: string }
> {
  "use step"

  const artifact = await getArtifactById(input.artifactId)
  if (!artifact || artifact.organizationId !== input.organizationId) {
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
}

export async function searchArtifactsStep(input: {
  organizationId: string
  contentId?: string
  runId?: string
  type?: string
  status?: string
}): Promise<{ count: number; artifacts: unknown[] }> {
  "use step"

  const results = await searchArtifactsQuery({
    organizationId: input.organizationId,
    contentId: input.contentId,
    runId: input.runId,
    type: input.type,
    status: input.status as ArtifactStatus | undefined,
  })
  return { count: results.length, artifacts: results }
}

// ---------------------------------------------------------------------------
// Web search step
// ---------------------------------------------------------------------------

export async function webSearchStep(input: {
  query: string
  numResults?: number
}): Promise<{
  results: Array<{ title: string; url: string; snippet: string }>
}> {
  "use step"

  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) throw new Error("EXA_API_KEY is not configured")

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query: input.query,
      numResults: input.numResults ?? 5,
      type: "auto",
      contents: { text: { maxCharacters: 2000 } },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Exa API error: ${response.status} ${response.statusText}`,
    )
  }

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
}

// ---------------------------------------------------------------------------
// Sub-agent step
// ---------------------------------------------------------------------------

/**
 * Runs a sub-agent inside a single step boundary.
 * Full Node.js access — resolves model, builds tools, runs generateText.
 */
export async function runSubAgentStep(input: {
  subAgentId: string
  instructions: string
  artifactIds?: string[]
  organizationId: string
  projectId: string
  contentId?: string
  agentId: string
  runId: string
}): Promise<string> {
  "use step"

  const subAgent = getBuiltInAgent(input.subAgentId)
  if (!subAgent) throw new Error(`Sub-agent not found: ${input.subAgentId}`)

  const model = await resolveModel(
    subAgent.modelId ?? null,
    input.organizationId,
  )

  // Build sub-agent tools (regular tool(), not step-based — we're already in a step)
  const subToolRecords = getBuiltInAgentTools(subAgent.id)
  const subTools = buildSubAgentTools(subToolRecords, {
    organizationId: input.organizationId,
    projectId: input.projectId,
    contentId: input.contentId,
    agentId: input.agentId,
    runId: input.runId,
  })

  let prompt = input.instructions
  if (input.artifactIds && input.artifactIds.length > 0) {
    prompt += `\n\nUse load-artifact to load these artifacts as input: ${input.artifactIds.join(", ")}`
  }

  const result = await generateText({
    model,
    system: subAgent.prompt,
    messages: [{ role: "user" as const, content: prompt }],
    tools: subTools,
    stopWhen: stepCountIs(10),
  })

  return result.text
}

/**
 * Build regular (non-step) tools for sub-agents.
 * These run inside the parent step boundary with full Node.js access.
 */
function buildSubAgentTools(
  toolRecords: Array<{
    type: string
    referenceId: string
  }>,
  ctx: {
    organizationId: string
    projectId: string
    contentId?: string
    agentId: string
    runId: string
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {}

  // Artifact tools (always available for sub-agents)
  tools["save-artifact"] = tool({
    description:
      "Save an artifact (research notes, blog draft, etc.) to the database.",
    inputSchema: z.object({
      type: z
        .string()
        .describe('Artifact type, e.g. "research-notes", "blog-draft"'),
      title: z.string().describe("A short title for the artifact"),
      data: z
        .record(z.string(), z.unknown())
        .describe(
          "The artifact payload as a JSON object. For research-notes: { keywords, sources, insights }. " +
            "For blog-draft: { markdown, title, metadata: { wordCount, readingTime } }.",
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
      const version = ctx.contentId
        ? await getNextArtifactVersion(ctx.contentId, type)
        : 1
      const artifact = await createArtifact({
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        contentId: ctx.contentId,
        agentId: ctx.agentId,
        runId: ctx.runId,
        type,
        title,
        data,
        version,
        parentIds,
      })
      if (type === "blog-draft" && ctx.contentId) {
        await updateContentStage(ctx.contentId, "draft", ctx.organizationId)
      }
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
      if (!artifact || artifact.organizationId !== ctx.organizationId) {
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
    description:
      "Search for existing artifacts. Filter by type, content, run, or status.",
    inputSchema: z.object({
      contentId: z.string().optional(),
      runId: z.string().optional(),
      type: z.string().optional(),
      status: z
        .enum(["pending", "ready", "approved", "rejected"])
        .optional(),
    }),
    execute: async ({
      contentId,
      runId,
      type,
      status,
    }: {
      contentId?: string
      runId?: string
      type?: string
      status?: string
    }) => {
      const results = await searchArtifactsQuery({
        organizationId: ctx.organizationId,
        contentId: contentId ?? (ctx.contentId || undefined),
        runId,
        type,
        status: status as ArtifactStatus | undefined,
      })
      return { count: results.length, artifacts: results }
    },
  })

  // Function tools
  for (const record of toolRecords) {
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

          if (!response.ok) {
            throw new Error(
              `Exa API error: ${response.status} ${response.statusText}`,
            )
          }

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

  return tools
}

// ---------------------------------------------------------------------------
// Persistence steps
// ---------------------------------------------------------------------------

export async function persistRunCompletion(
  runId: string,
  resultMessages: Array<{ role: string; content?: unknown }>,
) {
  "use step"

  const newMsgs = resultMessages.map((m, i) => ({
    id: `${runId}-msg-${i}`,
    role: m.role as "user" | "assistant" | "system" | "tool",
    parts: JSON.stringify(m.content ?? null),
    metadata: undefined,
  }))

  if (newMsgs.length > 0) {
    await saveMessages(runId, newMsgs)
  }

  await updateAgentRunStatus(runId, "completed", {
    completedAt: new Date(),
  })
}

export async function persistRunFailure(
  runId: string,
  errorMessage: string,
) {
  "use step"

  await updateAgentRunStatus(runId, "failed", {
    error: { code: "AGENT_ERROR", message: errorMessage },
  }).catch((statusErr: unknown) => {
    console.error("Failed to update agent run status:", runId, statusErr)
  })
}
