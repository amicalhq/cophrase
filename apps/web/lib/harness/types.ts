import type { ContentType, ContentStage } from "@workspace/db"

export interface HarnessConfig {
  systemPrompt: string
  availableAgents: string[]
}

export interface ContentContext {
  contentId: string
  contentType: ContentType
  contentStage: ContentStage
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
