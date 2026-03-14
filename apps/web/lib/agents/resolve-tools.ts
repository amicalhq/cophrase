import type { ToolSet } from "ai"
import { getFunctionFromRegistry } from "./tools/registry"
import { createSaveArtifactTool } from "./tools/save-artifact"
import { createLoadArtifactTool } from "./tools/load-artifact"
import { createSearchArtifactsTool } from "./tools/search-artifacts"
import { createAgentAsTool } from "./agent-as-tool"
import { getBuiltInAgent } from "./built-in/registry"
import type { AgentConfig, AgentToolRecord, RunContext } from "./types"

/**
 * Resolves agent tool DB records into an AI SDK ToolSet.
 *
 * This function is SYNCHRONOUS — it does not perform any DB or I/O operations.
 * It must be callable inside a workflow context (which disallows Node.js modules).
 *
 * - "function" type tools are looked up from the built-in tool registry
 * - "agent" type tools are looked up from the built-in agent registry (v1: no DB agents as sub-agents)
 * - "mcp-server" type tools are skipped for v1
 *
 * Artifact tools (save, load, search) are always included as baseline tools.
 */
export function resolveTools(
  _agentConfig: AgentConfig,
  toolRecords: AgentToolRecord[],
  ctx: RunContext,
): ToolSet {
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
        // V1: only built-in agents can be sub-agents.
        // DB agent lookup requires async I/O which is not allowed in workflow context.
        // Post-v1: pre-fetch DB agent configs in a step and pass them here.
        const subAgentConfig = getBuiltInAgent(record.referenceId)
        if (subAgentConfig) {
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
