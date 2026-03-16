import { eq, and, desc } from "drizzle-orm"
import { db } from "../index"
import { content } from "../schema/content"
import { user } from "../schema/auth"
import type { ContentType, ContentStage } from "../schema/enums"

export async function getContentByProject(projectId: string) {
  return await db
    .select({
      id: content.id,
      title: content.title,
      type: content.type,
      stage: content.stage,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      creatorName: user.name,
    })
    .from(content)
    .leftJoin(user, eq(content.createdBy, user.id))
    .where(eq(content.projectId, projectId))
    .orderBy(desc(content.updatedAt))
}

export async function getContentById(id: string, projectId: string) {
  const [result] = await db
    .select({
      id: content.id,
      title: content.title,
      type: content.type,
      stage: content.stage,
      organizationId: content.organizationId,
      projectId: content.projectId,
      createdBy: content.createdBy,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    })
    .from(content)
    .where(and(eq(content.id, id), eq(content.projectId, projectId)))
  return result ?? null
}

export async function createContent(input: {
  projectId: string
  organizationId: string
  createdBy: string
  title: string
  type: ContentType
}) {
  const [created] = await db
    .insert(content)
    .values({
      projectId: input.projectId,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      title: input.title,
      type: input.type,
    })
    .returning({
      id: content.id,
      title: content.title,
      type: content.type,
      stage: content.stage,
    })
  if (!created) {
    throw new Error("Failed to insert content row")
  }
  return created
}

export async function updateContentStage(id: string, stage: ContentStage, organizationId: string) {
  const [result] = await db
    .update(content)
    .set({ stage })
    .where(and(eq(content.id, id), eq(content.organizationId, organizationId)))
    .returning()
  return result ?? null
}

export async function getContentByIdOnly(id: string) {
  const [result] = await db
    .select({
      id: content.id,
      title: content.title,
      type: content.type,
      stage: content.stage,
      organizationId: content.organizationId,
      projectId: content.projectId,
      createdBy: content.createdBy,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    })
    .from(content)
    .where(eq(content.id, id))
  return result ?? null
}
