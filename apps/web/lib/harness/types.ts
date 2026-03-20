export interface HarnessConfig {
  systemPrompt: string
  availableAgents: string[]
}

export interface ContentContext {
  contentId: string
  contentType: string
  contentStage: string
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
