import type { ModelMessage, ToolSet, UIMessageChunk } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import { resolveModel } from "./resolve-model"
import { resolveTools } from "./resolve-tools"
import { getAgentTools } from "@workspace/db/queries/agents"
import {
  saveMessages,
  getExistingMessageIds,
} from "@workspace/db/queries/agent-runs"
import { chatMessageHook } from "./hooks"
import type { AgentConfig, AgentToolRecord, RunContext } from "./types"

// ---------------------------------------------------------------------------
// Step functions — Node.js / DB operations must be in "use step" functions.
// IMPORTANT: Step return values must be serializable (plain objects/arrays).
// Do NOT return class instances, functions, or AI SDK tool objects from steps.
// ---------------------------------------------------------------------------

async function loadToolRecords(agentId: string): Promise<AgentToolRecord[]> {
  "use step"
  return (await getAgentTools(agentId)) as AgentToolRecord[]
}

async function resolveModelStep(modelId: string | null, organizationId: string) {
  "use step"
  return resolveModel(modelId, organizationId)
}

async function persistNewMessages(
  runId: string,
  messages: ModelMessage[],
) {
  "use step"
  const existingIds = await getExistingMessageIds(runId)
  const newMessages = messages.filter(
    (m) => "id" in m && typeof m.id === "string" && !existingIds.has(m.id),
  )

  if (newMessages.length === 0) return

  await saveMessages(
    runId,
    newMessages.map((m) => ({
      id: (m as ModelMessage & { id: string }).id,
      role: m.role as "user" | "assistant" | "system" | "tool",
      parts: "content" in m ? m.content : null,
      metadata: undefined,
    })),
  )
}

// ---------------------------------------------------------------------------
// Workflow functions
// ---------------------------------------------------------------------------

/**
 * Single-shot agent run. Creates a DurableAgent, resolves tools, and streams.
 */
export async function runAgent(
  agentConfig: AgentConfig,
  input: {
    messages: ModelMessage[]
    context: RunContext
  },
) {
  "use workflow"

  // Tool records are plain data (serializable) — safe to fetch in a step
  const toolRecords = await loadToolRecords(agentConfig.id)

  // Tools contain functions (non-serializable) — must be built in the workflow,
  // NOT inside a step. resolveTools returns ToolSet which contains execute fns.
  // Each tool's execute fn has "use step" internally for durability.
  const tools = resolveTools(agentConfig, toolRecords, input.context)

  const agent = new DurableAgent({
    // Model resolution does I/O (DB + decrypt) — wrapped in a step
    model: () => resolveModelStep(agentConfig.modelId ?? null, input.context.organizationId),
    tools: tools as ToolSet,
    system: agentConfig.prompt,
  })

  const result = await agent.stream({
    messages: input.messages,
    writable: getWritable<UIMessageChunk>(),
  })

  await persistNewMessages(input.context.runId, result.messages)

  return result
}

/**
 * Multi-turn orchestrator chat. Runs in a while(true) loop, suspending on a
 * chatMessageHook between turns.
 */
export async function orchestratorChat(
  agentConfig: AgentConfig,
  initialMessages: ModelMessage[],
  runId: string,
  context: RunContext,
) {
  "use workflow"

  const toolRecords = await loadToolRecords(agentConfig.id)

  // Build tools in workflow context (not a step) — they contain functions
  const tools = resolveTools(agentConfig, toolRecords, context)

  const agent = new DurableAgent({
    model: () => resolveModelStep(agentConfig.modelId ?? null, context.organizationId),
    tools: tools as ToolSet,
    system: agentConfig.prompt,
  })

  let messages = initialMessages

  const firstResult = await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    preventClose: true,
  })

  messages = firstResult.messages
  await persistNewMessages(runId, messages)

  while (true) {
    const hook = chatMessageHook.create({
      token: `chat:${runId}`,
    })

    const newMessages = await hook

    messages = [...messages, ...newMessages]

    const result = await agent.stream({
      messages,
      writable: getWritable<UIMessageChunk>(),
      preventClose: true,
    })

    messages = result.messages
    await persistNewMessages(runId, messages)
  }
}
