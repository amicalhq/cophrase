/**
 * Harness durable workflow — uses DurableAgent from @workflow/ai for
 * checkpointing, retry, stream reconnection, and observability.
 *
 * All DB-accessing functions live in steps.ts (separate file required by
 * the Workflow compiler — workflow bundles cannot include Node.js modules).
 */

import type { UIMessageChunk } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import { z } from "zod"
import {
  loadConversationStep,
  buildContextStep,
  createHarnessModelStepFn,
  persistHarnessMessages,
  runAgentStep,
  getContentStatusStep,
  searchArtifactsStep,
  getAgentDescriptionsStep,
} from "./steps"
import { HARNESS_CONFIGS } from "./configs"
import { extractTextFromParts } from "./utils"
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

    // Step 3: Resolve agent descriptions (DB access via step)
    const agentDescriptions = await getAgentDescriptionsStep(
      config.availableAgents,
    )

    const systemPrompt = `${config.systemPrompt}

${dynamicContext}

Available agents you can delegate to:
${agentDescriptions}`

    // Build harness tools — delegates to step-wrapped tool handlers
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
          return runAgentStep({
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
          return getContentStatusStep(ctx)
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
          return searchArtifactsStep({
            organizationId: args.organizationId,
            contentId: args.contentId,
            type,
            status,
          })
        },
      },
    }

    // Parse user message (passed as JSON string to avoid devalue serialization issues)
    const userMsg = JSON.parse(userMessageJson) as {
      role: "user"
      content: string
    }

    // The user message is saved in the route handler before the workflow starts.
    // Check if it's already in the history to avoid duplicating it.
    const lastMsg = history[history.length - 1]
    const historyIncludesUserMsg =
      lastMsg?.role === "user" &&
      extractTextFromParts(lastMsg.parts) === userMsg.content

    // Combine history + new user message (only if not already present)
    // Use JSON round-trip to get ModelMessage[] typing (same pattern as run-agent.ts)
    const rawMessages = [
      ...history.map((m) => ({
        role: m.role,
        content: extractTextFromParts(m.parts),
      })),
      ...(historyIncludesUserMsg ? [] : [userMsg]),
    ]
    const messages = JSON.parse(JSON.stringify(rawMessages))

    // Step 4: Create DurableAgent and stream
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

    // Step 5: Persist a single assistant message with tool call metadata
    // Collect all text across messages, and tool calls from steps
    const allText = result.messages
      .filter((m) => m.role === "assistant")
      .map((m) => {
        if (!("content" in m)) return ""
        const content = m.content
        if (typeof content === "string") return content
        if (Array.isArray(content)) {
          return content
            .filter((p) =>
              typeof p === "object" && p !== null && "type" in p &&
              (p as { type: string }).type === "text" && "text" in p)
            .map((p) => (p as { text: string }).text)
            .join("")
        }
        return ""
      })
      .filter(Boolean)
      .join("\n\n")

    // Serialize result to plain object (workflow bundler uses proxies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = JSON.parse(JSON.stringify(result))

    // Extract tool calls from all steps
    const toolCalls: Array<{
      toolCallId: string
      toolName: string
      input?: unknown
      result?: unknown
      state: "complete"
    }> = []

    for (const step of r.steps ?? []) {
      for (const tc of step.toolCalls ?? []) {
        const tr = (step.toolResults ?? []).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => t.toolCallId === tc.toolCallId,
        )
        toolCalls.push({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input ?? tc.args,
          result: tr?.output ?? tr?.result,
          state: "complete",
        })
      }
    }

    // Also check top-level toolCalls/toolResults (from last step)
    for (const tc of r.toolCalls ?? []) {
      if (!toolCalls.some((t) => t.toolCallId === tc.toolCallId)) {
        const tr = (r.toolResults ?? []).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => t.toolCallId === tc.toolCallId,
        )
        toolCalls.push({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input ?? tc.args,
          result: tr?.output ?? tr?.result,
          state: "complete",
        })
      }
    }

    // Extract reasoning text
    let reasoning = ""
    for (const step of r.steps ?? []) {
      if (typeof step.reasoningText === "string" && step.reasoningText) {
        reasoning += (reasoning ? "\n" : "") + step.reasoningText
      } else if (Array.isArray(step.reasoning)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = step.reasoning
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
          .filter(Boolean)
          .join("")
        if (text) reasoning += (reasoning ? "\n" : "") + text
      }
    }

    const metadata: Record<string, unknown> = {}
    if (toolCalls.length > 0) metadata.toolCalls = toolCalls
    if (reasoning) metadata.reasoning = reasoning

    await persistHarnessMessages([
      {
        organizationId: args.organizationId,
        contentId: args.contentId,
        role: "assistant" as const,
        parts: allText,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    ])

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
