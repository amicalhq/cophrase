import type { ModelMessage, UIMessageChunk } from "ai"
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
import type { AgentConfig, RunContext } from "./types"

/**
 * Persists only new messages (those not already in the database) for a given run.
 */
async function persistNewMessages(
  runId: string,
  messages: ModelMessage[],
) {
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

/**
 * Single-shot agent run. Creates a DurableAgent, resolves tools, and streams a response.
 * This is a workflow function — it must be called from within a workflow context.
 */
export async function runAgent(
  agentConfig: AgentConfig,
  input: {
    messages: ModelMessage[]
    context: RunContext
  },
) {
  "use workflow"

  const toolRecords = await getAgentTools(agentConfig.id)
  const tools = await resolveTools(agentConfig, toolRecords, input.context)

  const agent = new DurableAgent({
    model: () =>
      resolveModel(agentConfig.modelId!, input.context.organizationId),
    tools,
    system: agentConfig.prompt,
  })

  const result = await agent.stream({
    messages: input.messages,
    writable: getWritable<UIMessageChunk>(),
  })

  // Persist messages after the agent completes
  await persistNewMessages(input.context.runId, result.messages)

  return result
}

/**
 * Multi-turn orchestrator chat. Runs in a while(true) loop, suspending on a
 * chatMessageHook between turns. Each turn streams the agent's response and
 * persists new messages.
 *
 * This is a workflow function — it must be called from within a workflow context.
 */
export async function orchestratorChat(
  agentConfig: AgentConfig,
  initialMessages: ModelMessage[],
  runId: string,
  context: RunContext,
) {
  "use workflow"

  const toolRecords = await getAgentTools(agentConfig.id)
  const tools = await resolveTools(agentConfig, toolRecords, context)

  const agent = new DurableAgent({
    model: () =>
      resolveModel(agentConfig.modelId!, context.organizationId),
    tools,
    system: agentConfig.prompt,
  })

  let messages = initialMessages

  // First turn with initial messages
  const firstResult = await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    preventClose: true,
  })

  messages = firstResult.messages
  await persistNewMessages(runId, messages)

  // Subsequent turns driven by chat message hook
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
