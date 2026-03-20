import { searchArtifacts } from "@workspace/db/queries/artifacts"
import { getContentByIdOnly, updateContentStage } from "@workspace/db/queries/content"
import { getAgentTools } from "@workspace/db/queries/agents"
import { createAgentRun } from "@workspace/db/queries/agent-runs"
import { runSubAgentInline } from "./steps"
import type {
  ContentContext,
  ArtifactSummary,
  DynamicHarnessConfig,
} from "./types"
import type { ArtifactStatus } from "@workspace/db"

export async function handleGetContentStatus(
  ctx: ContentContext,
  config: DynamicHarnessConfig,
): Promise<{
  currentStageId: string | null
  currentStageName: string | null
  stagePosition: number | null
  totalStages: number
  title: string
  artifacts: ArtifactSummary[]
}> {
  const contentRow = await getContentByIdOnly(ctx.contentId)
  const artifacts = await searchArtifacts({
    organizationId: ctx.organizationId,
    contentId: ctx.contentId,
  })

  const currentStage = config.stages.find(
    (s) => s.id === contentRow?.currentStageId,
  )

  return {
    currentStageId: contentRow?.currentStageId ?? null,
    currentStageName: currentStage?.name ?? null,
    stagePosition: currentStage?.position ?? null,
    totalStages: config.stages.length,
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

export async function handleRunStage(input: {
  stageId: string
  config: DynamicHarnessConfig
  organizationId: string
  projectId: string
  contentId: string
  createdBy: string
}): Promise<{
  success: boolean
  stageName: string
  artifacts: ArtifactSummary[]
  subAgentResults: Array<{
    agentName: string
    success: boolean
    artifacts: ArtifactSummary[]
    error?: string
  }>
  error?: string
}> {
  const stage = input.config.stages.find((s) => s.id === input.stageId)
  if (!stage) {
    return {
      success: false,
      stageName: "unknown",
      artifacts: [],
      subAgentResults: [],
      error: `Stage ${input.stageId} not found in content type`,
    }
  }

  if (stage.subAgents.length === 0) {
    return {
      success: false,
      stageName: stage.name,
      artifacts: [],
      subAgentResults: [],
      error: `Stage "${stage.name}" has no sub-agents configured`,
    }
  }

  const allArtifacts: ArtifactSummary[] = []
  const subAgentResults: Array<{
    agentName: string
    success: boolean
    artifacts: ArtifactSummary[]
    error?: string
  }> = []

  // Run each sub-agent in executionOrder
  for (const sa of stage.subAgents) {
    // Resolve tools from DB (in case any were added after config was loaded)
    const toolRecords = await getAgentTools(sa.agentId)

    // Create an agent run record
    const run = await createAgentRun({
      organizationId: input.organizationId,
      projectId: input.projectId,
      contentId: input.contentId,
      agentId: sa.agentId,
      createdBy: input.createdBy,
      executionMode: "auto",
    })

    try {
      const result = await runSubAgentInline({
        agentPrompt: sa.prompt,
        agentModelId: sa.modelId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        contentId: input.contentId,
        agentId: sa.agentId,
        runId: run.id,
        toolRecords: toolRecords.map((t) => ({
          type: t.type,
          referenceId: t.referenceId,
        })),
      })

      allArtifacts.push(...result.artifacts)
      subAgentResults.push({
        agentName: sa.name,
        success: true,
        artifacts: result.artifacts,
      })
    } catch (err) {
      const { updateAgentRunStatus } = await import(
        "@workspace/db/queries/agent-runs"
      )
      await updateAgentRunStatus(run.id, "failed", {
        error: {
          code: "AGENT_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      }).catch(console.error)

      subAgentResults.push({
        agentName: sa.name,
        success: false,
        artifacts: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const allSucceeded = subAgentResults.every((r) => r.success)

  // Only advance currentStageId if all sub-agents succeeded
  if (allSucceeded) {
    const currentPos = stage.position
    const nextStage = input.config.stages.find(
      (s) => s.position === currentPos + 1,
    )
    const nextStageId = nextStage?.id ?? null // null = pipeline complete

    await updateContentStage(
      input.contentId,
      nextStageId,
      input.organizationId,
    )
  }

  return {
    success: allSucceeded,
    stageName: stage.name,
    artifacts: allArtifacts,
    subAgentResults,
    error: allSucceeded
      ? undefined
      : "Some sub-agents failed — stage was not advanced. See subAgentResults for details.",
  }
}
