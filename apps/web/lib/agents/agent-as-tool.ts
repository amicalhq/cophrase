import { z } from "zod"
import { tool } from "ai"
import type { UIMessageChunk } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"
import type { AgentConfig, RunContext } from "./types"
import { resolveModel } from "./resolve-model"
import { resolveTools } from "./resolve-tools"
import { getAgentTools } from "@workspace/db/queries/agents"

/**
 * Wraps a sub-agent as an AI SDK tool that can be called by an orchestrator.
 * The sub-agent runs as a durable workflow step and streams its output.
 */
export function createAgentAsTool(
  agentConfig: AgentConfig,
  ctx: RunContext,
) {
  return tool({
    description: agentConfig.description,
    inputSchema: z.object({
      input: z.string().describe("Input for the sub-agent"),
    }),
    execute: async ({ input }) => {
      "use step"

      const toolRecords = await getAgentTools(agentConfig.id)
      const tools = await resolveTools(agentConfig, toolRecords, ctx)

      const agent = new DurableAgent({
        model: () => resolveModel(agentConfig.modelId!, ctx.organizationId),
        tools,
        system: agentConfig.prompt,
      })

      const result = await agent.stream({
        messages: [{ role: "user", content: input }],
        writable: getWritable<UIMessageChunk>(),
        preventClose: true,
        sendStart: false,
        sendFinish: false,
      })

      // Extract text content from the final messages
      const lastAssistant = result.messages
        .filter((m) => m.role === "assistant")
        .pop()

      const textContent =
        typeof lastAssistant?.content === "string"
          ? lastAssistant.content
          : Array.isArray(lastAssistant?.content)
            ? lastAssistant.content
                .filter(
                  (p): p is { type: "text"; text: string } =>
                    typeof p === "object" && p !== null && "type" in p && p.type === "text",
                )
                .map((p) => p.text)
                .join("")
            : ""

      return { output: textContent }
    },
  })
}
