/**
 * Agent runner — uses AI SDK streamText directly.
 *
 * V1: No Workflow DevKit durability wrapper. The agent runs as a standard
 * streamText call with tools. Durability (checkpointing, replay, resume)
 * will be added post-v1 once we resolve the serialization constraints
 * of Workflow DevKit (model instances and tool functions are not serializable).
 */

import type { ModelMessage, ToolSet, UIMessageChunk } from "ai"
import { streamText, generateText, stepCountIs } from "ai"
import { z } from "zod"
import { tool } from "ai"
import { resolveModel } from "./resolve-model"
import { getAgentTools } from "@workspace/db/queries/agents"
import {
  updateAgentRunStatus,
  saveMessages,
} from "@workspace/db/queries/agent-runs"
import {
  createArtifact,
  getArtifactById,
  getNextArtifactVersion,
  searchArtifacts as searchArtifactsQuery,
} from "@workspace/db/queries/artifacts"
import { updateContentStage } from "@workspace/db/queries/content"
import { getBuiltInAgent, getBuiltInAgentTools } from "./built-in/registry"
import type { AgentConfig, AgentToolRecord, RunContext } from "./types"
import type { ArtifactStatus } from "@workspace/db"

// ---------------------------------------------------------------------------
// Tool construction
// ---------------------------------------------------------------------------

function buildArtifactTools(ctx: RunContext): ToolSet {
  return {
    "save-artifact": tool({
      description:
        "Save an artifact (research notes, blog draft, etc.) to the database.",
      inputSchema: z.object({
        type: z.string().describe('Artifact type, e.g. "research-notes", "blog-draft"'),
        title: z.string().describe("A short title for the artifact"),
        data: z.record(z.string(), z.unknown()).describe(
        "The artifact payload as a JSON object. For research-notes: { keywords, sources, insights }. " +
        "For blog-draft: { markdown, title, metadata: { wordCount, readingTime } }."
      ),
        parentIds: z.array(z.string()).optional().describe("IDs of parent artifacts"),
      }),
      execute: async ({ type, title, data, parentIds }) => {
        const version = ctx.contentId
          ? await getNextArtifactVersion(ctx.contentId, type)
          : 1

        const artifact = await createArtifact({
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          contentId: ctx.contentId ?? undefined,
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

        return { artifactId: artifact.id, type: artifact.type, version: artifact.version }
      },
    }),
    "load-artifact": tool({
      description: "Load a previously saved artifact by its ID.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID to load"),
      }),
      execute: async ({ artifactId }) => {
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
    }),
    "search-artifacts": tool({
      description: "Search for existing artifacts. Filter by type, content, run, or status.",
      inputSchema: z.object({
        contentId: z.string().optional(),
        runId: z.string().optional(),
        type: z.string().optional(),
        status: z.enum(["pending", "ready", "approved", "rejected"]).optional(),
      }),
      execute: async ({ contentId, runId, type, status }) => {
        const results = await searchArtifactsQuery({
          organizationId: ctx.organizationId,
          contentId: contentId ?? (ctx.contentId || undefined),
          runId,
          type,
          status: status as ArtifactStatus | undefined,
        })
        return { count: results.length, artifacts: results }
      },
    }),
  }
}

function buildTools(
  toolRecords: AgentToolRecord[],
  ctx: RunContext,
  { includeArtifactTools = true }: { includeArtifactTools?: boolean } = {},
): ToolSet {
  const tools: ToolSet = {}

  // Only worker agents get artifact tools.
  // Orchestrators should delegate to sub-agents, not use artifact tools directly.
  if (includeArtifactTools) {
    Object.assign(tools, buildArtifactTools(ctx))
  }

  for (const record of toolRecords) {
    switch (record.type) {
      case "function": {
        if (record.referenceId === "web-search") {
          tools["web-search"] = tool({
            description: "Search the web for information on a topic.",
            inputSchema: z.object({
              query: z.string().describe("The search query"),
              numResults: z.number().min(1).max(10).optional(),
            }),
            execute: async ({ query, numResults = 5 }) => {
              const apiKey = process.env.EXA_API_KEY
              if (!apiKey) throw new Error("EXA_API_KEY is not configured")

              const response = await fetch("https://api.exa.ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({
                  query,
                  numResults,
                  type: "auto",
                  contents: { text: { maxCharacters: 2000 } },
                }),
              })

              if (!response.ok) {
                throw new Error(`Exa API error: ${response.status} ${response.statusText}`)
              }

              const data = await response.json()
              return {
                results: (data.results ?? []).map((r: any) => ({
                  title: r.title,
                  url: r.url,
                  snippet: r.text?.slice(0, 500),
                })),
              }
            },
          })
        }
        break
      }

      case "agent": {
        const subAgent = getBuiltInAgent(record.referenceId)
        if (subAgent) {
          tools[subAgent.name] = tool({
            description: subAgent.description,
            inputSchema: z.object({
              instructions: z
                .string()
                .describe("Detailed instructions for what the sub-agent should do"),
              artifactIds: z
                .array(z.string())
                .optional()
                .describe("IDs of artifacts the sub-agent should load and use as input"),
            }),
            execute: async ({ instructions, artifactIds }) => {
              const model = await resolveModel(
                subAgent.modelId ?? null,
                ctx.organizationId,
              )
              const subToolRecords = getBuiltInAgentTools(subAgent.id)
              const subTools = buildTools(subToolRecords, ctx)

              // Build a rich prompt including artifact references
              let prompt = instructions
              if (artifactIds && artifactIds.length > 0) {
                prompt += `\n\nUse load-artifact to load these artifacts as input: ${artifactIds.join(", ")}`
              }

              const result = await generateText({
                model,
                system: subAgent.prompt,
                messages: [{ role: "user" as const, content: prompt }],
                tools: subTools,
                stopWhen: stepCountIs(10),
              })

              return result.text
            },
          })
        }
        break
      }

      case "mcp-server":
        break
    }
  }

  return tools
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the orchestrator agent and returns a UI message stream.
 */
export async function runOrchestrator(
  agentConfig: AgentConfig,
  messages: ModelMessage[],
  context: RunContext,
): Promise<ReadableStream<UIMessageChunk>> {
  // Load tool records: built-in first, then DB fallback
  let toolRecords = getBuiltInAgentTools(agentConfig.id)
  if (toolRecords.length === 0) {
    toolRecords = (await getAgentTools(agentConfig.id)) as AgentToolRecord[]
  }

  // Orchestrators don't get artifact tools — they delegate to sub-agents
  const hasSubAgentTools = toolRecords.some((r) => r.type === "agent")
  const tools = buildTools(toolRecords, context, {
    includeArtifactTools: !hasSubAgentTools,
  })
  const model = await resolveModel(agentConfig.modelId ?? null, context.organizationId)

  const result = streamText({
    model,
    system: agentConfig.prompt,
    messages,
    tools,
    stopWhen: stepCountIs(20),
  })

  // Ensure backend completes processing even if client disconnects.
  // Without this, a client disconnect would cancel the stream and leave
  // the run stuck in "running" status forever.
  result.consumeStream()

  // Persist messages and update run status after stream is consumed (non-blocking).
  // result.response resolves when streaming completes (including after disconnect).
  const persistAndComplete = async () => {
    try {
      const response = await result.response
      // Save response messages. ResponseMessage contains ModelMessage content format,
      // so we serialize the content as JSON for the parts column.
      const newMsgs = response.messages.map((m, i) => ({
        id: `${context.runId}-msg-${i}`,
        role: m.role as "user" | "assistant" | "system" | "tool",
        parts: JSON.stringify("content" in m ? m.content : null),
        metadata: undefined,
      }))

      if (newMsgs.length > 0) {
        await saveMessages(context.runId, newMsgs)
      }

      await updateAgentRunStatus(context.runId, "completed", {
        completedAt: new Date(),
      })
    } catch (err) {
      console.error("Agent run failed:", err)
      await updateAgentRunStatus(context.runId, "failed", {
        error: { code: "AGENT_ERROR", message: String(err) },
      }).catch((statusErr) => {
        console.error("Failed to update agent run status:", context.runId, statusErr)
      })
    }
  }

  // Fire and forget — don't block the stream response
  persistAndComplete().catch((err) => {
    console.error("Unhandled error in persistAndComplete for run:", context.runId, err)
  })

  return result.toUIMessageStream()
}
