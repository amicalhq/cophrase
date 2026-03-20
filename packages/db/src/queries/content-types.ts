import { eq, asc } from "drizzle-orm"
import { db } from "../index"
import {
  contentType,
  contentTypeStage,
  subAgent,
} from "../schema/content-types"
import { agent } from "../schema/agents"

export async function getContentTypesByProject(projectId: string) {
  return await db
    .select()
    .from(contentType)
    .where(eq(contentType.projectId, projectId))
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
