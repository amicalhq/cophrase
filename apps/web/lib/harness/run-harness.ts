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
  runStageStep,
  getContentStatusStep,
  searchArtifactsStep,
  loadHarnessConfigStep,
} from "./steps"
import { extractTextFromParts } from "./utils"
import type { ContentContext } from "./types"

// ---------------------------------------------------------------------------
// Serializable workflow args
// ---------------------------------------------------------------------------

export interface HarnessWorkflowArgs {
  contentId: string
  contentTypeId: string
  contentTitle: string
  organizationId: string
  projectId: string
  createdBy: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGEST_ACTIONS_INSTRUCTION = `
IMPORTANT: After your text response is complete, you MUST use the suggest-next-actions tool to suggest 2-4 next steps. Do NOT write suggestion JSON in your text — use the tool. Consider the current pipeline stage, what was just accomplished, any errors, and available stages. Mark exactly one suggestion as primary. Keep labels short (2-5 words) but make prompts descriptive enough for you to act on.`

// ---------------------------------------------------------------------------
// Harness workflow
// ---------------------------------------------------------------------------

export async function runHarnessWorkflow(
  args: HarnessWorkflowArgs,
  userMessageJson: string
) {
  "use workflow"

  const ctx: ContentContext = {
    contentId: args.contentId,
    contentTypeId: args.contentTypeId,
    contentTitle: args.contentTitle,
    organizationId: args.organizationId,
    projectId: args.projectId,
  }

  const config = await loadHarnessConfigStep(args.contentTypeId)
  if (!config) {
    throw new Error(`No harness config for content type: ${args.contentTypeId}`)
  }

  try {
    // Step 1: Load conversation history
    const history = await loadConversationStep(args.contentId, 50)

    // Step 2: Build dynamic context
    const dynamicContext = await buildContextStep(ctx, config)

    const systemPrompt = `${config.contentAgent.prompt}

${dynamicContext}
${SUGGEST_ACTIONS_INSTRUCTION}`

    // Build harness tools — delegates to step-wrapped tool handlers
    const tools = {
      "run-stage": {
        description:
          "Execute all sub-agents at a pipeline stage. Pass the stageId.",
        inputSchema: z.object({
          stageId: z.string().describe("The contentTypeStage.id to execute"),
        }),
        execute: async ({ stageId }: { stageId: string }) => {
          return runStageStep({
            stageId,
            config,
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
          return getContentStatusStep(ctx, config)
        },
      },
      "search-artifacts": {
        description: "Search for existing artifacts. Filter by type or status.",
        inputSchema: z.object({
          type: z.string().optional().describe("Artifact type to filter by"),
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
      "suggest-next-actions": {
        description:
          "After completing your response, suggest 2-4 next actions the user might want to take. Always call this at the end of every turn.",
        inputSchema: z.object({
          suggestions: z
            .array(
              z.object({
                label: z.string().describe("Short button label, 2-5 words"),
                prompt: z
                  .string()
                  .describe("The full prompt to send if the user selects this"),
                primary: z
                  .boolean()
                  .optional()
                  .describe("True for the single recommended next action"),
              })
            )
            .min(2)
            .max(4),
        }),
        execute: async () => {
          return { ok: true }
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
            .filter(
              (p) =>
                typeof p === "object" &&
                p !== null &&
                "type" in p &&
                (p as { type: string }).type === "text" &&
                "text" in p
            )
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
          (t: any) => t.toolCallId === tc.toolCallId
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
          (t: any) => t.toolCallId === tc.toolCallId
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
          .map((p: any) => (typeof p === "string" ? p : (p?.text ?? "")))
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
