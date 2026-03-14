import type { AgentConfig, AgentToolRecord } from "../types"
import {
  researchAgentConfig,
  researchAgentTools,
} from "./research-agent"
import {
  draftingAgentConfig,
  draftingAgentTools,
} from "./drafting-agent"
import {
  humanizerAgentConfig,
  humanizerAgentTools,
} from "./humanizer-agent"
import {
  blogOrchestratorConfig,
  blogOrchestratorTools,
} from "./blog-orchestrator"

/**
 * All built-in agent configurations, keyed by agent ID.
 */
export const builtInAgents: Record<string, AgentConfig> = {
  [researchAgentConfig.id]: researchAgentConfig,
  [draftingAgentConfig.id]: draftingAgentConfig,
  [humanizerAgentConfig.id]: humanizerAgentConfig,
  [blogOrchestratorConfig.id]: blogOrchestratorConfig,
}

/**
 * All built-in agent tool records, keyed by agent ID.
 */
export const builtInAgentTools: Record<string, AgentToolRecord[]> = {
  [researchAgentConfig.id]: researchAgentTools,
  [draftingAgentConfig.id]: draftingAgentTools,
  [humanizerAgentConfig.id]: humanizerAgentTools,
  [blogOrchestratorConfig.id]: blogOrchestratorTools,
}

/**
 * Retrieves a built-in agent config by ID, or null if not found.
 */
export function getBuiltInAgent(id: string): AgentConfig | null {
  return builtInAgents[id] ?? null
}

/**
 * Retrieves tool records for a built-in agent by agent ID, or an empty array if not found.
 */
export function getBuiltInAgentTools(agentId: string): AgentToolRecord[] {
  return builtInAgentTools[agentId] ?? []
}
