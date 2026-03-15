/**
 * Durable agent workflow — uses DurableAgent from @workflow/ai for
 * checkpointing, retry, stream reconnection, and observability.
 *
 * Model resolution uses a step function that loads provider config from DB
 * inside the step boundary, avoiding both closure serialization issues
 * and Vercel AI Gateway dependency.
 *
 * All DB-accessing functions live in steps.ts (separate file required by
 * the Workflow compiler — workflow bundles cannot include Node.js modules).
 */

import type { ModelMessage, UIMessageChunk } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import { z } from "zod"
import {
  createModelStepFn,
  saveArtifactStep,
  loadArtifactStep,
  searchArtifactsStep,
  webSearchStep,
  runSubAgentStep,
  persistRunCompletion,
  persistRunFailure,
} from "./steps"
import { getBuiltInAgent } from "./built-in/registry"
import type { AgentToolRecord } from "./types"

// ---------------------------------------------------------------------------
// Serializable workflow args (all values must survive devalue serialization)
// ---------------------------------------------------------------------------

export interface WorkflowRunArgs {
  agentId: string
  agentPrompt: string
  agentModelId: string | null
  toolRecords: AgentToolRecord[]
  hasSubAgentTools: boolean
  organizationId: string
  projectId: string
  contentId?: string
  runId: string
}

// ---------------------------------------------------------------------------
// Tool construction (execute functions delegate to step functions)
// ---------------------------------------------------------------------------

function buildTools(args: WorkflowRunArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {}

  // Only worker agents get artifact tools.
  // Orchestrators should delegate to sub-agents, not use artifact tools directly.
  if (!args.hasSubAgentTools) {
    tools["save-artifact"] = {
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
      execute: async (input: {
        type: string
        title: string
        data: Record<string, unknown>
        parentIds?: string[]
      }) => {
        return saveArtifactStep({
          ...input,
          organizationId: args.organizationId,
          projectId: args.projectId,
          contentId: args.contentId,
          agentId: args.agentId,
          runId: args.runId,
        })
      },
    }

    tools["load-artifact"] = {
      description: "Load a previously saved artifact by its ID.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID to load"),
      }),
      execute: async ({ artifactId }: { artifactId: string }) => {
        return loadArtifactStep({
          artifactId,
          organizationId: args.organizationId,
        })
      },
    }

    tools["search-artifacts"] = {
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
      execute: async (input: {
        contentId?: string
        runId?: string
        type?: string
        status?: string
      }) => {
        return searchArtifactsStep({
          organizationId: args.organizationId,
          contentId: input.contentId ?? args.contentId,
          runId: input.runId,
          type: input.type,
          status: input.status,
        })
      },
    }
  }

  for (const record of args.toolRecords) {
    switch (record.type) {
      case "function": {
        if (record.referenceId === "web-search") {
          tools["web-search"] = {
            description: "Search the web for information on a topic.",
            inputSchema: z.object({
              query: z.string().describe("The search query"),
              numResults: z.number().min(1).max(10).optional(),
            }),
            execute: async (input: {
              query: string
              numResults?: number
            }) => {
              return webSearchStep(input)
            },
          }
        }
        break
      }

      case "agent": {
        const subAgent = getBuiltInAgent(record.referenceId)
        if (subAgent) {
          tools[subAgent.name] = {
            description: subAgent.description,
            inputSchema: z.object({
              instructions: z
                .string()
                .describe(
                  "Detailed instructions for what the sub-agent should do",
                ),
              artifactIds: z
                .array(z.string())
                .optional()
                .describe(
                  "IDs of artifacts the sub-agent should load and use as input",
                ),
            }),
            execute: async (input: {
              instructions: string
              artifactIds?: string[]
            }) => {
              return runSubAgentStep({
                subAgentId: record.referenceId,
                instructions: input.instructions,
                artifactIds: input.artifactIds,
                organizationId: args.organizationId,
                projectId: args.projectId,
                contentId: args.contentId,
                agentId: args.agentId,
                runId: args.runId,
              })
            },
          }
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
// Workflow function
// ---------------------------------------------------------------------------

/**
 * Main durable agent workflow.
 *
 * Called via: start(runAgentWorkflow, [args, messagesJson])
 * Messages are passed as a JSON string to avoid devalue serialization issues.
 */
export async function runAgentWorkflow(
  args: WorkflowRunArgs,
  messagesJson: string,
) {
  "use workflow"

  const messages: ModelMessage[] = JSON.parse(messagesJson)

  try {
    // Build tools — execute functions delegate to step functions in steps.ts
    const tools = buildTools(args)

    // Create the durable agent with step-function model resolution
    const agent = new DurableAgent({
      model: createModelStepFn(args.agentModelId, args.organizationId),
      system: args.agentPrompt,
      tools,
    })

    const writable = getWritable<UIMessageChunk>()

    // Run the agent — DurableAgent handles the loop, streaming, tool cycling
    const result = await agent.stream({
      messages,
      writable,
      maxSteps: 20,
    })

    // Persist messages and mark run as completed
    const serializedMessages = result.messages.map((m) => ({
      role: m.role,
      content: "content" in m ? m.content : undefined,
    }))
    await persistRunCompletion(args.runId, serializedMessages)

    return { messageCount: result.messages.length, steps: result.steps.length }
  } catch (err) {
    await persistRunFailure(args.runId, String(err))
    throw err
  }
}
