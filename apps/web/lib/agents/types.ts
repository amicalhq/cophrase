import type { AgentScope, ExecutionMode, AgentToolType } from "@workspace/db"
import type { ModelMessage } from "ai"

export interface AgentConfig {
  id: string
  scope: AgentScope
  organizationId?: string | null
  name: string
  description: string
  modelId?: string | null
  prompt: string
  inputSchema?: unknown
  outputSchema?: unknown
  executionMode: ExecutionMode
  approvalSteps?: string[] | null
}

export interface AgentToolRecord {
  id: string
  agentId: string
  type: AgentToolType
  referenceId: string
  required: boolean
  config?: unknown
}

export interface RunContext {
  organizationId: string
  projectId: string
  contentId?: string
  agentId: string
  runId: string
}

export interface AgentInput {
  messages: ModelMessage[]
  runId?: string
  context?: RunContext
}
