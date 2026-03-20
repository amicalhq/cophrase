export interface DynamicHarnessConfig {
  contentTypeId: string
  contentTypeName: string
  format: string
  contentAgent: {
    id: string
    prompt: string
    modelId: string | null
  }
  stages: StageConfig[]
}

export interface StageConfig {
  id: string
  name: string
  position: number
  optional: boolean
  subAgents: SubAgentConfig[]
}

export interface SubAgentConfig {
  id: string
  agentId: string
  name: string
  prompt: string
  modelId: string | null
  executionOrder: number
  tools: Array<{
    type: string
    referenceId: string
    required: boolean
    config: unknown
  }>
}

export interface ContentContext {
  contentId: string
  contentTypeId: string
  contentTitle: string
  organizationId: string
  projectId: string
}

export interface ArtifactSummary {
  id: string
  type: string
  title: string
  version: number
  status: string
}
