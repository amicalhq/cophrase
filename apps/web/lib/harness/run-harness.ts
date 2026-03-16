import type { UIMessageChunk } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import { z } from "zod"
import {
  loadConversationStep,
  buildContextStep,
  createHarnessModelStepFn,
  persistHarnessMessages,
} from "./steps"
import {
  handleRunAgent,
  handleGetContentStatus,
  handleSearchArtifacts,
} from "./tool-handlers"
import { HARNESS_CONFIGS } from "./configs"
import { getBuiltInAgent } from "../agents/built-in/registry"
import type { ContentContext } from "./types"
import type { ContentType } from "@workspace/db"

// ---------------------------------------------------------------------------
// Serializable workflow args
// ---------------------------------------------------------------------------

export interface HarnessWorkflowArgs {
  contentId: string
  contentType: ContentType
  contentStage: string
  contentTitle: string
  organizationId: string
  projectId: string
  createdBy: string
}

// ---------------------------------------------------------------------------
// Harness workflow
// ---------------------------------------------------------------------------

export async function runHarnessWorkflow(
  args: HarnessWorkflowArgs,
  userMessageJson: string,
) {
  "use workflow"

  const ctx: ContentContext = {
    contentId: args.contentId,
    contentType: args.contentType,
    contentStage: args.contentStage as ContentContext["contentStage"],
    contentTitle: args.contentTitle,
    organizationId: args.organizationId,
    projectId: args.projectId,
  }

  const config = HARNESS_CONFIGS[args.contentType]
  if (!config) {
    throw new Error(`No harness config for content type: ${args.contentType}`)
  }

  try {
    // Step 1: Load conversation history
    const history = await loadConversationStep(args.contentId, 50)

    // Step 2: Build dynamic context
    const dynamicContext = await buildContextStep(ctx)

    // Build available agents description for system prompt
    const agentDescriptions = config.availableAgents
      .map((id) => {
        const agent = getBuiltInAgent(id)
        return agent ? `- ${id}: ${agent.description}` : `- ${id}`
      })
      .join("\n")

    const systemPrompt = `${config.systemPrompt}

${dynamicContext}

Available agents you can delegate to:
${agentDescriptions}`

    // Build harness tools — delegates to shared tool-handlers.ts
    const tools = {
      "run-agent": {
        description:
          "Delegate work to a specialized agent. The agent will execute and save artifacts.",
        inputSchema: z.object({
          agentId: z.string().describe("The agent ID to run"),
          instructions: z
            .string()
            .describe("Detailed instructions for the agent"),
        }),
        execute: async ({
          agentId,
          instructions,
        }: {
          agentId: string
          instructions: string
        }) => {
          return handleRunAgent({
            agentId,
            instructions,
            organizationId: args.organizationId,
            projectId: args.projectId,
            contentId: args.contentId,
            createdBy: args.createdBy,
          })
        },
      },
      "get-content-status": {
        description:
          "Get the current status of this content piece including stage and artifacts.",
        inputSchema: z.object({}),
        execute: async () => {
          return handleGetContentStatus(ctx)
        },
      },
      "search-artifacts": {
        description:
          "Search for existing artifacts. Filter by type or status.",
        inputSchema: z.object({
          type: z
            .string()
            .optional()
            .describe("Artifact type to filter by"),
          status: z
            .enum(["pending", "ready", "approved", "rejected"])
            .optional(),
        }),
        execute: async ({
          type,
          status,
        }: {
          type?: string
          status?: string
        }) => {
          return handleSearchArtifacts({
            organizationId: args.organizationId,
            contentId: args.contentId,
            type,
            status,
          })
        },
      },
    }

    // Parse user message (passed as JSON string to avoid devalue serialization issues)
    const userMessage = JSON.parse(userMessageJson) as {
      role: "user"
      content: string
    }

    // Combine history + new user message
    // Use JSON round-trip to get ModelMessage[] typing (same pattern as run-agent.ts)
    const rawMessages = [
      ...history.map((m) => ({
        role: m.role,
        content:
          typeof m.parts === "string" ? m.parts : JSON.stringify(m.parts),
      })),
      userMessage,
    ]
    const messages = JSON.parse(JSON.stringify(rawMessages))

    // Step 3: Create DurableAgent and stream
    const agent = new DurableAgent({
      model: createHarnessModelStepFn(args.organizationId),
      system: systemPrompt,
      tools,
    })

    const writable = getWritable<UIMessageChunk>()

    const result = await agent.stream({
      messages,
      writable,
      maxSteps: 20,
    })

    // Step 4: Persist messages
    const userMsg = {
      organizationId: args.organizationId,
      contentId: args.contentId,
      role: "user" as const,
      parts: userMessage.content,
    }

    const assistantMsgs = result.messages
      .filter((m) => m.role === "assistant")
      .map((m) => ({
        organizationId: args.organizationId,
        contentId: args.contentId,
        role: "assistant" as const,
        parts: "content" in m ? m.content : null,
      }))

    await persistHarnessMessages([userMsg, ...assistantMsgs])

    return { messageCount: result.messages.length, steps: result.steps.length }
  } catch (err) {
    // Persist an error message so the user sees feedback in chat
    await persistHarnessMessages([
      {
        organizationId: args.organizationId,
        contentId: args.contentId,
        role: "assistant" as const,
        parts: `I encountered an error while processing your request. Please try again.`,
        metadata: {
          error: err instanceof Error ? err.message : String(err),
        },
      },
    ]).catch((persistErr) => {
      console.error("Failed to persist harness error message:", persistErr)
    })
    throw err
  }
}
