import { eq, asc, sql, inArray, and } from "drizzle-orm"
import { db } from "../index"
import {
  contentType,
  contentTypeStage,
  subAgent,
} from "../schema/content-types"
import { agent, agentTool } from "../schema/agents"
import { artifact } from "../schema/artifacts"
import { content } from "../schema/content"
import {
  createAgentId,
  createAgentToolId,
  createContentTypeId,
  createContentTypeStageId,
  createSubAgentId,
} from "@workspace/id"

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getContentTypesByProject(projectId: string) {
  const types = await db
    .select()
    .from(contentType)
    .where(eq(contentType.projectId, projectId))

  if (types.length === 0) return []

  const typeIds = types.map((t) => t.id)
  const allStages = await db
    .select()
    .from(contentTypeStage)
    .where(inArray(contentTypeStage.contentTypeId, typeIds))
    .orderBy(asc(contentTypeStage.position))

  const stagesByTypeId = new Map<string, (typeof allStages)[number][]>()
  for (const stage of allStages) {
    const list = stagesByTypeId.get(stage.contentTypeId) ?? []
    list.push(stage)
    stagesByTypeId.set(stage.contentTypeId, list)
  }

  return types.map((t) => ({
    ...t,
    stages: stagesByTypeId.get(t.id) ?? [],
  }))
}

export async function getAppContentTypes() {
  return await db
    .select()
    .from(contentType)
    .where(eq(contentType.scope, "app"))
}

export async function getContentTypeById(id: string) {
  const [result] = await db
    .select()
    .from(contentType)
    .where(eq(contentType.id, id))
  return result ?? null
}

export async function getContentTypeWithStages(id: string) {
  const ct = await getContentTypeById(id)
  if (!ct) return null

  const stages = await db
    .select()
    .from(contentTypeStage)
    .where(eq(contentTypeStage.contentTypeId, id))
    .orderBy(asc(contentTypeStage.position))

  const stagesWithSubAgents = await Promise.all(
    stages.map(async (stage) => {
      const subAgents = await db
        .select({
          id: subAgent.id,
          stageId: subAgent.stageId,
          agentId: subAgent.agentId,
          executionOrder: subAgent.executionOrder,
          agentName: agent.name,
          agentDescription: agent.description,
        })
        .from(subAgent)
        .innerJoin(agent, eq(subAgent.agentId, agent.id))
        .where(eq(subAgent.stageId, stage.id))
        .orderBy(asc(subAgent.executionOrder))
      return { ...stage, subAgents }
    }),
  )

  return { ...ct, stages: stagesWithSubAgents }
}

export async function getStagesByContentType(contentTypeId: string) {
  return await db
    .select()
    .from(contentTypeStage)
    .where(eq(contentTypeStage.contentTypeId, contentTypeId))
    .orderBy(asc(contentTypeStage.position))
}

export async function getSubAgentsByStage(stageId: string) {
  return await db
    .select({
      id: subAgent.id,
      stageId: subAgent.stageId,
      agentId: subAgent.agentId,
      executionOrder: subAgent.executionOrder,
      agentName: agent.name,
      agentDescription: agent.description,
    })
    .from(subAgent)
    .innerJoin(agent, eq(subAgent.agentId, agent.id))
    .where(eq(subAgent.stageId, stageId))
    .orderBy(asc(subAgent.executionOrder))
}

export async function getStageWithContext(stageId: string, contentId: string) {
  const [stage] = await db
    .select()
    .from(contentTypeStage)
    .where(eq(contentTypeStage.id, stageId))
  if (!stage) return null

  const subAgents = await db
    .select({
      id: subAgent.id,
      agentId: subAgent.agentId,
      executionOrder: subAgent.executionOrder,
      agentName: agent.name,
      agentDescription: agent.description,
    })
    .from(subAgent)
    .innerJoin(agent, eq(subAgent.agentId, agent.id))
    .where(eq(subAgent.stageId, stageId))
    .orderBy(asc(subAgent.executionOrder))

  const subAgentAgentIds = subAgents.map((sa) => sa.agentId)
  let tools: Array<{
    agentId: string
    type: string
    referenceId: string
    config: unknown
  }> = []
  if (subAgentAgentIds.length > 0) {
    tools = await db
      .select({
        agentId: agentTool.agentId,
        type: agentTool.type,
        referenceId: agentTool.referenceId,
        config: agentTool.config,
      })
      .from(agentTool)
      .where(inArray(agentTool.agentId, subAgentAgentIds))
  }

  const existingArtifacts = await db
    .select({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title,
      status: artifact.status,
    })
    .from(artifact)
    .where(eq(artifact.contentId, contentId))
    .orderBy(asc(artifact.createdAt))

  return {
    stage: {
      id: stage.id,
      contentTypeId: stage.contentTypeId,
      name: stage.name,
      description: stage.description,
      position: stage.position,
      optional: stage.optional,
    },
    subAgents: subAgents.map((sa) => ({
      name: sa.agentName,
      description: sa.agentDescription,
      tools: tools
        .filter((t) => t.agentId === sa.agentId)
        .map((t) => ({ type: t.type, referenceId: t.referenceId, config: t.config })),
    })),
    existingArtifacts,
  }
}

// ---------------------------------------------------------------------------
// getHarnessConfig
// ---------------------------------------------------------------------------

/**
 * Load the full harness configuration for a content type.
 * Returns the Content Agent (prompt, model) and the full stage→sub-agent pipeline
 * with each sub-agent's tools.
 */
export async function getHarnessConfig(contentTypeId: string) {
  // 1. Load content type + content agent
  const [ct] = await db
    .select({
      id: contentType.id,
      name: contentType.name,
      format: contentType.format,
      agentId: contentType.agentId,
      agentPrompt: agent.prompt,
      agentModelId: agent.modelId,
    })
    .from(contentType)
    .leftJoin(agent, eq(contentType.agentId, agent.id))
    .where(eq(contentType.id, contentTypeId))

  if (!ct) return null
  if (!ct.agentId || !ct.agentPrompt) return null

  // 2. Load stages ordered by position
  const stages = await db
    .select()
    .from(contentTypeStage)
    .where(eq(contentTypeStage.contentTypeId, contentTypeId))
    .orderBy(asc(contentTypeStage.position))

  // 3. Load sub-agents for all stages (with agent row data)
  const stageIds = stages.map((s) => s.id)
  let allSubAgents: Array<{
    id: string
    stageId: string
    agentId: string
    executionOrder: number
    agentName: string
    agentPrompt: string
    agentModelId: string | null
  }> = []

  if (stageIds.length > 0) {
    allSubAgents = await db
      .select({
        id: subAgent.id,
        stageId: subAgent.stageId,
        agentId: subAgent.agentId,
        executionOrder: subAgent.executionOrder,
        agentName: agent.name,
        agentPrompt: agent.prompt,
        agentModelId: agent.modelId,
      })
      .from(subAgent)
      .innerJoin(agent, eq(subAgent.agentId, agent.id))
      .where(inArray(subAgent.stageId, stageIds))
      .orderBy(asc(subAgent.executionOrder))
  }

  // 4. Load tools for all sub-agent agent IDs
  const subAgentAgentIds = allSubAgents.map((sa) => sa.agentId)
  let allTools: Array<{
    id: string
    agentId: string
    type: string
    referenceId: string
    required: boolean
    config: unknown
  }> = []

  if (subAgentAgentIds.length > 0) {
    allTools = await db
      .select({
        id: agentTool.id,
        agentId: agentTool.agentId,
        type: agentTool.type,
        referenceId: agentTool.referenceId,
        required: agentTool.required,
        config: agentTool.config,
      })
      .from(agentTool)
      .where(inArray(agentTool.agentId, subAgentAgentIds))
  }

  // 5. Group tools by agentId
  const toolsByAgent = new Map<string, typeof allTools>()
  for (const tool of allTools) {
    const list = toolsByAgent.get(tool.agentId) ?? []
    list.push(tool)
    toolsByAgent.set(tool.agentId, list)
  }

  // 6. Group sub-agents by stageId
  const subAgentsByStage = new Map<string, typeof allSubAgents>()
  for (const sa of allSubAgents) {
    const list = subAgentsByStage.get(sa.stageId) ?? []
    list.push(sa)
    subAgentsByStage.set(sa.stageId, list)
  }

  // 7. Assemble
  return {
    contentTypeId: ct.id,
    contentTypeName: ct.name,
    format: ct.format,
    contentAgent: {
      id: ct.agentId,
      prompt: ct.agentPrompt,
      modelId: ct.agentModelId,
    },
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      optional: s.optional,
      subAgents: (subAgentsByStage.get(s.id) ?? []).map((sa) => ({
        id: sa.id,
        agentId: sa.agentId,
        name: sa.agentName,
        prompt: sa.agentPrompt,
        modelId: sa.agentModelId,
        executionOrder: sa.executionOrder,
        tools: (toolsByAgent.get(sa.agentId) ?? []).map((t) => ({
          id: t.id,
          type: t.type,
          referenceId: t.referenceId,
          required: t.required,
          config: t.config,
        })),
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Basic inserts
// ---------------------------------------------------------------------------

export async function createContentType(input: {
  scope: "app" | "project"
  organizationId?: string
  projectId?: string
  sourceId?: string
  name: string
  description?: string
  format: "rich_text" | "plain_text" | "image" | "video" | "deck"
  frontmatterSchema?: Record<string, unknown>
  agentId?: string
  icon?: string
}) {
  const [created] = await db
    .insert(contentType)
    .values(input)
    .returning()
  if (!created) throw new Error("Failed to insert content type")
  return created
}

export async function createContentTypeStage(input: {
  contentTypeId: string
  name: string
  description?: string
  position: number
  optional?: boolean
}) {
  const [created] = await db
    .insert(contentTypeStage)
    .values(input)
    .returning()
  if (!created) throw new Error("Failed to insert content type stage")
  return created
}

export async function createSubAgent(input: {
  stageId: string
  agentId: string
  executionOrder?: number
}) {
  const [created] = await db
    .insert(subAgent)
    .values(input)
    .returning()
  if (!created) throw new Error("Failed to insert sub-agent")
  return created
}

export async function deleteContentType(id: string) {
  const [deleted] = await db
    .delete(contentType)
    .where(eq(contentType.id, id))
    .returning()
  return deleted ?? null
}

// ---------------------------------------------------------------------------
// installContentType
// ---------------------------------------------------------------------------

export async function installContentType({
  templateId,
  projectId,
  orgId,
}: {
  templateId: string
  projectId: string
  orgId: string
}) {
  return await db.transaction(async (tx) => {
    // 1. Read template content type
    const [template] = await tx
      .select()
      .from(contentType)
      .where(eq(contentType.id, templateId))
    if (!template) throw new Error("Template content type not found")
    if (template.scope !== "app")
      throw new Error("Source content type must be app-scoped")

    // 2. Copy content agent
    let newContentAgentId: string | undefined
    if (template.agentId) {
      const [templateAgent] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, template.agentId))
      if (templateAgent) {
        newContentAgentId = createAgentId()
        await tx.insert(agent).values({
          id: newContentAgentId,
          scope: "project",
          organizationId: orgId,
          projectId,
          sourceId: templateAgent.id,
          name: templateAgent.name,
          description: templateAgent.description,
          prompt: templateAgent.prompt,
          modelId: templateAgent.modelId,
          inputSchema: templateAgent.inputSchema,
          outputSchema: templateAgent.outputSchema,
          executionMode: templateAgent.executionMode,
          approvalSteps: templateAgent.approvalSteps,
        })
      }
    }

    // 3. Copy content type
    const newContentTypeId = createContentTypeId()
    const [newContentType] = await tx
      .insert(contentType)
      .values({
        id: newContentTypeId,
        scope: "project",
        organizationId: orgId,
        projectId,
        sourceId: templateId,
        agentId: newContentAgentId,
        name: template.name,
        description: template.description,
        format: template.format,
        frontmatterSchema: template.frontmatterSchema,
        icon: template.icon,
      })
      .returning()
    if (!newContentType) throw new Error("Failed to insert content type")

    // 4. Copy stages
    const templateStages = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, templateId))
      .orderBy(asc(contentTypeStage.position))

    const stageIdMap = new Map<string, string>()
    for (const templateStage of templateStages) {
      const newStageId = createContentTypeStageId()
      stageIdMap.set(templateStage.id, newStageId)
      await tx.insert(contentTypeStage).values({
        id: newStageId,
        contentTypeId: newContentTypeId,
        name: templateStage.name,
        description: templateStage.description,
        position: templateStage.position,
        optional: templateStage.optional,
      })
    }

    // 5. Copy sub-agents
    const templateStageIds = templateStages.map((s) => s.id)
    if (templateStageIds.length > 0) {
      const templateSubAgents = await tx
        .select()
        .from(subAgent)
        .where(inArray(subAgent.stageId, templateStageIds))
        .orderBy(asc(subAgent.executionOrder))

      // Map from template sub-agent's agentId to new sub-agent's agentId
      const subAgentIdMap = new Map<string, string>()

      for (const templateSA of templateSubAgents) {
        // 5a. Read template sub-agent's agent row
        const [templateSubAgentAgent] = await tx
          .select()
          .from(agent)
          .where(eq(agent.id, templateSA.agentId))
        if (!templateSubAgentAgent) continue

        // 5b. Insert new agent
        const newSubAgentAgentId = createAgentId()
        subAgentIdMap.set(templateSA.agentId, newSubAgentAgentId)
        await tx.insert(agent).values({
          id: newSubAgentAgentId,
          scope: "project",
          organizationId: orgId,
          projectId,
          sourceId: templateSubAgentAgent.id,
          name: templateSubAgentAgent.name,
          description: templateSubAgentAgent.description,
          prompt: templateSubAgentAgent.prompt,
          modelId: templateSubAgentAgent.modelId,
          inputSchema: templateSubAgentAgent.inputSchema,
          outputSchema: templateSubAgentAgent.outputSchema,
          executionMode: templateSubAgentAgent.executionMode,
          approvalSteps: templateSubAgentAgent.approvalSteps,
        })

        // 5c. Insert sub-agent join row
        const newStageId = stageIdMap.get(templateSA.stageId)
        if (!newStageId) continue
        await tx.insert(subAgent).values({
          id: createSubAgentId(),
          stageId: newStageId,
          agentId: newSubAgentAgentId,
          executionOrder: templateSA.executionOrder,
        })
      }

      // 6. Copy agent tools for each copied sub-agent
      for (const [templateAgentId, newAgentId] of subAgentIdMap) {
        const templateTools = await tx
          .select()
          .from(agentTool)
          .where(eq(agentTool.agentId, templateAgentId))

        for (const tool of templateTools) {
          await tx.insert(agentTool).values({
            id: createAgentToolId(),
            agentId: newAgentId,
            type: tool.type,
            referenceId: tool.referenceId,
            required: tool.required,
            config: tool.config,
          })
        }
      }
    }

    // Return the installed content type with stages
    const ct = newContentType
    const stages = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, newContentTypeId))
      .orderBy(asc(contentTypeStage.position))

    const stagesWithSubAgents = await Promise.all(
      stages.map(async (stage) => {
        const subAgents = await tx
          .select({
            id: subAgent.id,
            stageId: subAgent.stageId,
            agentId: subAgent.agentId,
            executionOrder: subAgent.executionOrder,
            agentName: agent.name,
            agentDescription: agent.description,
          })
          .from(subAgent)
          .innerJoin(agent, eq(subAgent.agentId, agent.id))
          .where(eq(subAgent.stageId, stage.id))
          .orderBy(asc(subAgent.executionOrder))
        return { ...stage, subAgents }
      }),
    )

    return { ...ct, stages: stagesWithSubAgents }
  })
}

// ---------------------------------------------------------------------------
// createContentTypeFromScratch
// ---------------------------------------------------------------------------

export async function createContentTypeFromScratch(input: {
  projectId: string
  orgId: string
  name: string
  description?: string
  format: "rich_text" | "plain_text" | "image" | "video" | "deck"
  frontmatterSchema?: Record<string, unknown>
  icon?: string
  stages: Array<{
    name: string
    position: number
    optional?: boolean
  }>
}) {
  return await db.transaction(async (tx) => {
    // 1. Auto-generate a Content Agent
    const stageList = input.stages
      .sort((a, b) => a.position - b.position)
      .map((s) => s.name)
      .join(" → ")

    const contentAgentId = createAgentId()
    await tx.insert(agent).values({
      id: contentAgentId,
      scope: "project",
      organizationId: input.orgId,
      projectId: input.projectId,
      name: `${input.name} Agent`,
      description: `Orchestrator agent for ${input.name} content type`,
      prompt: `You manage a ${input.name} pipeline with stages: ${stageList}. At each stage, invoke the assigned sub-agents using the run-stage tool. After all sub-agents in a stage complete, advance to the next stage. You can also answer questions directly and suggest next actions.`,
    })

    // 2. Create the content type
    const newContentTypeId = createContentTypeId()
    const [newContentType] = await tx
      .insert(contentType)
      .values({
        id: newContentTypeId,
        scope: "project",
        organizationId: input.orgId,
        projectId: input.projectId,
        agentId: contentAgentId,
        name: input.name,
        description: input.description,
        format: input.format,
        frontmatterSchema: input.frontmatterSchema,
        icon: input.icon,
      })
      .returning()
    if (!newContentType) throw new Error("Failed to create content type")

    // 3. Create stages
    for (const stage of input.stages) {
      await tx.insert(contentTypeStage).values({
        id: createContentTypeStageId(),
        contentTypeId: newContentTypeId,
        name: stage.name,
        position: stage.position,
        optional: stage.optional ?? false,
      })
    }

    // 4. Return with stages
    const stages = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, newContentTypeId))
      .orderBy(asc(contentTypeStage.position))

    return { ...newContentType, stages }
  })
}

// ---------------------------------------------------------------------------
// forkContentType
// ---------------------------------------------------------------------------

export async function forkContentType({
  contentTypeId,
  projectId,
  orgId,
}: {
  contentTypeId: string
  projectId: string
  orgId: string
}) {
  return await db.transaction(async (tx) => {
    // 1. Read source content type
    const [source] = await tx
      .select()
      .from(contentType)
      .where(eq(contentType.id, contentTypeId))
    if (!source) throw new Error("Content type not found")

    // 2. Copy content agent
    let newContentAgentId: string | undefined
    if (source.agentId) {
      const [sourceAgent] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, source.agentId))
      if (sourceAgent) {
        newContentAgentId = createAgentId()
        await tx.insert(agent).values({
          id: newContentAgentId,
          scope: "project",
          organizationId: orgId,
          projectId,
          sourceId: sourceAgent.id,
          name: sourceAgent.name,
          description: sourceAgent.description,
          prompt: sourceAgent.prompt,
          modelId: sourceAgent.modelId,
          inputSchema: sourceAgent.inputSchema,
          outputSchema: sourceAgent.outputSchema,
          executionMode: sourceAgent.executionMode,
          approvalSteps: sourceAgent.approvalSteps,
        })
      }
    }

    // 3. Copy content type
    const newContentTypeId = createContentTypeId()
    const [newCt] = await tx
      .insert(contentType)
      .values({
        id: newContentTypeId,
        scope: "project",
        organizationId: orgId,
        projectId,
        sourceId: contentTypeId,
        agentId: newContentAgentId,
        name: `${source.name} (Copy)`,
        description: source.description,
        format: source.format,
        frontmatterSchema: source.frontmatterSchema,
        icon: source.icon,
      })
      .returning()
    if (!newCt) throw new Error("Failed to fork content type")

    // 4. Copy stages
    const sourceStages = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, contentTypeId))
      .orderBy(asc(contentTypeStage.position))

    const stageIdMap = new Map<string, string>()
    for (const s of sourceStages) {
      const newStageId = createContentTypeStageId()
      stageIdMap.set(s.id, newStageId)
      await tx.insert(contentTypeStage).values({
        id: newStageId,
        contentTypeId: newContentTypeId,
        name: s.name,
        description: s.description,
        position: s.position,
        optional: s.optional,
      })
    }

    // 5. Copy sub-agents
    const sourceStageIds = sourceStages.map((s) => s.id)
    if (sourceStageIds.length > 0) {
      const sourceSubAgents = await tx
        .select()
        .from(subAgent)
        .where(inArray(subAgent.stageId, sourceStageIds))
        .orderBy(asc(subAgent.executionOrder))

      const subAgentIdMap = new Map<string, string>()

      for (const sa of sourceSubAgents) {
        const [sourceSubAgent] = await tx
          .select()
          .from(agent)
          .where(eq(agent.id, sa.agentId))
        if (!sourceSubAgent) continue

        const newSubAgentId = createAgentId()
        subAgentIdMap.set(sa.agentId, newSubAgentId)
        await tx.insert(agent).values({
          id: newSubAgentId,
          scope: "project",
          organizationId: orgId,
          projectId,
          sourceId: sourceSubAgent.id,
          name: sourceSubAgent.name,
          description: sourceSubAgent.description,
          prompt: sourceSubAgent.prompt,
          modelId: sourceSubAgent.modelId,
          inputSchema: sourceSubAgent.inputSchema,
          outputSchema: sourceSubAgent.outputSchema,
          executionMode: sourceSubAgent.executionMode,
          approvalSteps: sourceSubAgent.approvalSteps,
        })

        const newStageId = stageIdMap.get(sa.stageId)
        if (!newStageId) continue
        await tx.insert(subAgent).values({
          id: createSubAgentId(),
          stageId: newStageId,
          agentId: newSubAgentId,
          executionOrder: sa.executionOrder,
        })
      }

      // 6. Copy agent tools
      for (const [sourceAgentId, newAgentId] of subAgentIdMap) {
        const sourceTools = await tx
          .select()
          .from(agentTool)
          .where(eq(agentTool.agentId, sourceAgentId))

        for (const tool of sourceTools) {
          await tx.insert(agentTool).values({
            id: createAgentToolId(),
            agentId: newAgentId,
            type: tool.type,
            referenceId: tool.referenceId,
            required: tool.required,
            config: tool.config,
          })
        }
      }
    }

    // Return with stages
    const stages = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, newContentTypeId))
      .orderBy(asc(contentTypeStage.position))

    return { ...newCt, stages }
  })
}

// ---------------------------------------------------------------------------
// updateContentType
// ---------------------------------------------------------------------------

export async function updateContentType(
  id: string,
  fields: {
    name?: string
    description?: string
    frontmatterSchema?: Record<string, unknown>
  },
) {
  const [updated] = await db
    .update(contentType)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(contentType.id, id))
    .returning()
  return updated ?? null
}

// ---------------------------------------------------------------------------
// deleteContentTypeIfUnused
// ---------------------------------------------------------------------------

export async function deleteContentTypeIfUnused(id: string) {
  // Check for referencing content rows
  const referencingContent = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.contentTypeId, id))
    .limit(1)

  if (referencingContent.length > 0) {
    return { error: "in_use" as const }
  }

  return await db.transaction(async (tx) => {
    // Read the content type to get agentId
    const [ct] = await tx
      .select()
      .from(contentType)
      .where(eq(contentType.id, id))
    if (!ct) return { error: "in_use" as const }

    // Collect all sub-agent agentIds
    const stages = await tx
      .select({ id: contentTypeStage.id })
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, id))

    const stageIds = stages.map((s) => s.id)
    let subAgentAgentIds: string[] = []
    if (stageIds.length > 0) {
      const subAgents = await tx
        .select({ agentId: subAgent.agentId })
        .from(subAgent)
        .where(inArray(subAgent.stageId, stageIds))
      subAgentAgentIds = subAgents.map((sa) => sa.agentId)
    }

    // Delete the content type (cascades stages + sub-agent join rows)
    const [deleted] = await tx
      .delete(contentType)
      .where(eq(contentType.id, id))
      .returning()

    // Explicitly delete all sub-agent agent rows
    if (subAgentAgentIds.length > 0) {
      await tx.delete(agent).where(inArray(agent.id, subAgentAgentIds))
    }

    // Explicitly delete the content agent row
    if (ct.agentId) {
      await tx.delete(agent).where(eq(agent.id, ct.agentId))
    }

    return deleted ?? null
  })
}

// ---------------------------------------------------------------------------
// Stage CRUD
// ---------------------------------------------------------------------------

export async function addStage({
  contentTypeId: ctId,
  name,
  position,
  optional,
}: {
  contentTypeId: string
  name: string
  position?: number
  optional?: boolean
}) {
  let pos = position
  if (pos === undefined) {
    const [result] = await db
      .select({ maxPos: sql<number>`coalesce(max(${contentTypeStage.position}), 0)` })
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, ctId))
    pos = (result?.maxPos ?? 0) + 1
  }

  const [created] = await db
    .insert(contentTypeStage)
    .values({
      id: createContentTypeStageId(),
      contentTypeId: ctId,
      name,
      position: pos,
      optional: optional ?? false,
    })
    .returning()
  if (!created) throw new Error("Failed to insert stage")
  return created
}

export async function updateStage(
  id: string,
  fields: { name?: string; optional?: boolean },
) {
  const [updated] = await db
    .update(contentTypeStage)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(contentTypeStage.id, id))
    .returning()
  return updated ?? null
}

export async function deleteStage(id: string) {
  return await db.transaction(async (tx) => {
    // Read the stage to get contentTypeId
    const [stage] = await tx
      .select()
      .from(contentTypeStage)
      .where(eq(contentTypeStage.id, id))
    if (!stage) return null

    // Collect sub-agent agentIds for this stage
    const subAgents = await tx
      .select({ agentId: subAgent.agentId })
      .from(subAgent)
      .where(eq(subAgent.stageId, id))
    const subAgentAgentIds = subAgents.map((sa) => sa.agentId)

    // Delete the stage (cascades sub-agent join rows)
    const [deleted] = await tx
      .delete(contentTypeStage)
      .where(eq(contentTypeStage.id, id))
      .returning()

    // Explicitly delete collected agent rows
    if (subAgentAgentIds.length > 0) {
      await tx.delete(agent).where(inArray(agent.id, subAgentAgentIds))
    }

    // Set content.currentStageId = null where it references this stage
    await tx
      .update(content)
      .set({ currentStageId: null })
      .where(eq(content.currentStageId, id))

    return deleted ?? null
  })
}

export async function reorderStages(
  contentTypeId: string,
  stageIds: string[],
) {
  return await db.transaction(async (tx) => {
    // Query all stages for this content type
    const existingStages = await tx
      .select({ id: contentTypeStage.id })
      .from(contentTypeStage)
      .where(eq(contentTypeStage.contentTypeId, contentTypeId))

    const existingIds = new Set(existingStages.map((s) => s.id))
    const inputIds = new Set(stageIds)

    // Validate stageIds includes exactly all stage IDs
    if (
      existingIds.size !== inputIds.size ||
      ![...existingIds].every((id) => inputIds.has(id))
    ) {
      return { error: "stage_id_mismatch" as const }
    }

    // Set all positions to negative temps first to avoid unique constraint violations
    for (let i = 0; i < stageIds.length; i++) {
      await tx
        .update(contentTypeStage)
        .set({ position: -(i + 1) })
        .where(eq(contentTypeStage.id, stageIds[i]!))
    }

    // Set final positions
    for (let i = 0; i < stageIds.length; i++) {
      await tx
        .update(contentTypeStage)
        .set({ position: i + 1 })
        .where(eq(contentTypeStage.id, stageIds[i]!))
    }

    return { success: true as const }
  })
}

// ---------------------------------------------------------------------------
// Sub-agent binding
// ---------------------------------------------------------------------------

export async function bindSubAgent({
  stageId,
  agentId: agentIdParam,
  executionOrder,
}: {
  stageId: string
  agentId: string
  executionOrder?: number
}) {
  const [created] = await db
    .insert(subAgent)
    .values({
      id: createSubAgentId(),
      stageId,
      agentId: agentIdParam,
      executionOrder,
    })
    .returning()
  if (!created) throw new Error("Failed to bind sub-agent")
  return created
}

export async function unbindSubAgent(id: string) {
  // Read the sub-agent join row to get agentId
  const [sa] = await db
    .select()
    .from(subAgent)
    .where(eq(subAgent.id, id))
  if (!sa) return null

  return await db.transaction(async (tx) => {
    // Delete the join row
    const [deleted] = await tx
      .delete(subAgent)
      .where(eq(subAgent.id, id))
      .returning()

    // Delete the agent row (each sub-agent copy is specific to one binding)
    await tx.delete(agent).where(eq(agent.id, sa.agentId))

    return deleted ?? null
  })
}
