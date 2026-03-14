import type { ToolSet } from "ai"
import { getFunctionFromRegistry } from "./tools/registry"
import { createSaveArtifactTool } from "./tools/save-artifact"
import { createLoadArtifactTool } from "./tools/load-artifact"
import { createSearchArtifactsTool } from "./tools/search-artifacts"
import { createAgentAsTool } from "./agent-as-tool"
import { getAgentById } from "@workspace/db/queries/agents"
import { getBuiltInAgent } from "./built-in/registry"
import type { AgentConfig, AgentToolRecord, RunContext } from "./types"

/**
 * Resolves agent tool DB records into an AI SDK ToolSet.
 *
 * - "function" type tools are looked up from the built-in tool registry
 * - "agent" type tools wrap a sub-agent as a callable tool
 * - "mcp-server" type tools are skipped for v1
 *
 * Artifact tools (save, load, search) are always included as baseline tools.
 */
export async function resolveTools(
  _agentConfig: AgentConfig,
  toolRecords: AgentToolRecord[],
  ctx: RunContext,
): Promise<ToolSet> {
  const tools: ToolSet = {}

  // Always include artifact tools as baseline
  tools["save-artifact"] = createSaveArtifactTool(ctx)
  tools["load-artifact"] = createLoadArtifactTool()
  tools["search-artifacts"] = createSearchArtifactsTool(ctx)

  for (const record of toolRecords) {
    switch (record.type) {
      case "function": {
        const resolved = getFunctionFromRegistry(record.referenceId, ctx)
        if (resolved) {
          tools[record.referenceId] = resolved
        }
        break
      }

      case "agent": {
        // Try built-in agents first, then DB
        let subAgentConfig = getBuiltInAgent(record.referenceId)
        if (!subAgentConfig) {
          const dbAgent = await getAgentById(record.referenceId)
          if (dbAgent) {
            subAgentConfig = {
              id: dbAgent.id,
              scope: dbAgent.scope,
              organizationId: dbAgent.organizationId,
              name: dbAgent.name,
              description: dbAgent.description,
              modelId: dbAgent.modelId,
              prompt: dbAgent.prompt,
              inputSchema: dbAgent.inputSchema,
              outputSchema: dbAgent.outputSchema,
              executionMode: dbAgent.executionMode,
              approvalSteps: dbAgent.approvalSteps,
            }
          }
        }

        if (subAgentConfig && subAgentConfig.modelId) {
          tools[subAgentConfig.name] = createAgentAsTool(subAgentConfig, ctx)
        }
        break
      }

      case "mcp-server": {
        // MCP server tools are skipped in v1
        break
      }
    }
  }

  return tools
}
