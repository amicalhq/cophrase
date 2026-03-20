import { eq, and, desc } from "drizzle-orm"
import { db } from "../index"
import { content } from "../schema/content"
import { contentType, contentTypeStage } from "../schema/content-types"
import { user } from "../schema/auth"

export async function getContentByProject(projectId: string) {
  return await db
    .select({
      id: content.id,
      title: content.title,
      contentTypeId: content.contentTypeId,
      contentTypeName: contentType.name,
      contentTypeFormat: contentType.format,
      currentStageId: content.currentStageId,
      currentStageName: contentTypeStage.name,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      creatorName: user.name,
    })
    .from(content)
    .leftJoin(user, eq(content.createdBy, user.id))
    .leftJoin(contentType, eq(content.contentTypeId, contentType.id))
    .leftJoin(
      contentTypeStage,
      eq(content.currentStageId, contentTypeStage.id),
    )
    .where(eq(content.projectId, projectId))
    .orderBy(desc(content.updatedAt))
}

export async function getContentById(id: string, projectId: string) {
  const [result] = await db
    .select({
      id: content.id,
      title: content.title,
      contentTypeId: content.contentTypeId,
      contentFormat: contentType.format,
      currentStageId: content.currentStageId,
      organizationId: content.organizationId,
      projectId: content.projectId,
      createdBy: content.createdBy,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    })
    .from(content)
    .leftJoin(contentType, eq(content.contentTypeId, contentType.id))
    .where(and(eq(content.id, id), eq(content.projectId, projectId)))
  return result ?? null
}

export async function createContent(input: {
  projectId: string
  organizationId: string
  createdBy: string
  title: string
  contentTypeId: string
}) {
  const [created] = await db
    .insert(content)
    .values({
      projectId: input.projectId,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      title: input.title,
      contentTypeId: input.contentTypeId,
    })
    .returning({
      id: content.id,
      title: content.title,
      contentTypeId: content.contentTypeId,
      currentStageId: content.currentStageId,
    })
  if (!created) {
    throw new Error("Failed to insert content row")
  }
  return created
}

export async function updateContentStage(
  id: string,
  currentStageId: string | null,
  organizationId: string,
) {
  const [result] = await db
    .update(content)
    .set({ currentStageId })
    .where(
      and(eq(content.id, id), eq(content.organizationId, organizationId)),
    )
    .returning()
  return result ?? null
}

export async function getContentFrontmatter(contentId: string) {
  const [result] = await db
    .select({
      frontmatter: content.frontmatter,
      contentTypeId: content.contentTypeId,
    })
    .from(content)
    .where(eq(content.id, contentId))
  return result ?? null
}

export async function updateContentFrontmatter(
  contentId: string,
  frontmatter: Record<string, unknown>,
) {
  const [updated] = await db
    .update(content)
    .set({ frontmatter })
    .where(eq(content.id, contentId))
    .returning({ id: content.id, frontmatter: content.frontmatter })
  return updated ?? null
}

export async function getContentByIdOnly(id: string) {
  const [result] = await db
    .select({
      id: content.id,
      title: content.title,
      contentTypeId: content.contentTypeId,
      currentStageId: content.currentStageId,
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
