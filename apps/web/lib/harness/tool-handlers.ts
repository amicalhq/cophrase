import { searchArtifacts } from "@workspace/db/queries/artifacts"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { getBuiltInAgent, getBuiltInAgentTools } from "../agents/built-in/registry"
import { getAgentById, getAgentTools } from "@workspace/db/queries/agents"
import { createAgentRun } from "@workspace/db/queries/agent-runs"
import { runSubAgentInline } from "./steps"
import type { ContentContext, ArtifactSummary } from "./types"
import type { ArtifactStatus } from "@workspace/db"

export async function handleGetContentStatus(ctx: ContentContext): Promise<{
  stage: string
  title: string
  artifacts: ArtifactSummary[]
}> {
  const contentRow = await getContentByIdOnly(ctx.contentId)
  const artifacts = await searchArtifacts({
    organizationId: ctx.organizationId,
    contentId: ctx.contentId,
  })

  return {
    stage: contentRow?.stage ?? ctx.contentStage,
    title: contentRow?.title ?? ctx.contentTitle,
    artifacts: artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      version: a.version,
      status: a.status,
    })),
  }
}

export async function handleSearchArtifacts(input: {
  organizationId: string
  contentId?: string
  type?: string
  status?: string
}): Promise<{ count: number; artifacts: ArtifactSummary[] }> {
  const results = await searchArtifacts({
    organizationId: input.organizationId,
    contentId: input.contentId,
    type: input.type,
    status: input.status as ArtifactStatus | undefined,
  })

  return {
    count: results.length,
    artifacts: results.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      version: a.version,
      status: a.status,
    })),
  }
}

export async function handleRunAgent(input: {
  agentId: string
  instructions: string
  organizationId: string
  projectId: string
  contentId: string
  createdBy: string
}): Promise<{
  success: boolean
  agentName: string
  artifacts: ArtifactSummary[]
  error?: string
}> {
  // Resolve agent config: built-in first, then DB
  const builtIn = getBuiltInAgent(input.agentId)
  let agentName: string
  let agentPrompt: string
  let agentModelId: string | null = null

  if (builtIn) {
    agentName = builtIn.name
    agentPrompt = builtIn.prompt
    agentModelId = builtIn.modelId ?? null
  } else {
    const dbAgent = await getAgentById(input.agentId)
    if (!dbAgent) {
      return { success: false, agentName: input.agentId, artifacts: [], error: "Agent not found" }
    }
    agentName = dbAgent.name
    agentPrompt = dbAgent.prompt
    agentModelId = dbAgent.modelId
  }

  // Resolve tool records
  let toolRecords = getBuiltInAgentTools(input.agentId)
  if (toolRecords.length === 0) {
    const dbTools = await getAgentTools(input.agentId)
    toolRecords = dbTools as typeof toolRecords
  }

  // Create an agent run record
  const run = await createAgentRun({
    organizationId: input.organizationId,
    projectId: input.projectId,
    contentId: input.contentId,
    agentId: input.agentId,
    createdBy: input.createdBy,
    executionMode: "auto",
  })

  try {
    const result = await runSubAgentInline({
      agentPrompt: `${agentPrompt}\n\nAdditional instructions from the user:\n${input.instructions}`,
      agentModelId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      contentId: input.contentId,
      agentId: input.agentId,
      runId: run.id,
      toolRecords,
    })

    return {
      success: true,
      agentName,
      artifacts: result.artifacts,
    }
  } catch (err) {
    // Mark the agent run as failed so it doesn't stay stuck in "running"
    const { updateAgentRunStatus } = await import("@workspace/db/queries/agent-runs")
    await updateAgentRunStatus(run.id, "failed", {
      error: { code: "AGENT_ERROR", message: err instanceof Error ? err.message : String(err) },
    }).catch((statusErr) => {
      console.error("Failed to update agent run status:", statusErr)
    })

    return {
      success: false,
      agentName,
      artifacts: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
