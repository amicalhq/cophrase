import { eq, and, desc, sql, ilike } from "drizzle-orm"
import { db } from "../index"
import { resource, resourceContent } from "../schema/resources"
import type { ResourceType, ResourceCategory } from "../schema/enums"

export async function getResourcesByProject(
  projectId: string,
  filters?: {
    type?: ResourceType
    category?: ResourceCategory
    search?: string
  },
) {
  const conditions = [eq(resource.projectId, projectId)]

  if (filters?.type) {
    conditions.push(eq(resource.type, filters.type))
  }
  if (filters?.category) {
    conditions.push(eq(resource.category, filters.category))
  }
  if (filters?.search) {
    const escaped = filters.search.replace(/[%_]/g, "\\$&")
    conditions.push(ilike(resource.title, `%${escaped}%`))
  }

  return await db
    .select({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      category: resource.category,
      linkUrl: resource.linkUrl,
      fileUrl: resource.fileUrl,
      fileName: resource.fileName,
      fileMimeType: resource.fileMimeType,
      fileSize: resource.fileSize,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    })
    .from(resource)
    .where(and(...conditions))
    .orderBy(desc(resource.updatedAt))
}

export async function getResourceById(
  id: string,
  projectId: string,
  organizationId: string,
) {
  const [result] = await db
    .select({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      category: resource.category,
      linkUrl: resource.linkUrl,
      fileUrl: resource.fileUrl,
      fileName: resource.fileName,
      fileMimeType: resource.fileMimeType,
      fileSize: resource.fileSize,
      organizationId: resource.organizationId,
      projectId: resource.projectId,
      createdBy: resource.createdBy,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    })
    .from(resource)
    .where(
      and(
        eq(resource.id, id),
        eq(resource.projectId, projectId),
        eq(resource.organizationId, organizationId),
      ),
    )
  return result ?? null
}

export async function getResourceContent(resourceId: string) {
  const [result] = await db
    .select({
      id: resourceContent.id,
      content: resourceContent.content,
    })
    .from(resourceContent)
    .where(eq(resourceContent.resourceId, resourceId))
  return result ?? null
}

export async function createResource(input: {
  projectId: string
  organizationId: string
  createdBy: string
  title: string
  type: ResourceType
  category: ResourceCategory
  linkUrl?: string
  fileUrl?: string
  fileName?: string
  fileMimeType?: string
  fileSize?: number
  content?: Record<string, unknown>
}) {
  const { content, ...resourceData } = input

  if (input.type === "text" && content) {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(resource)
        .values(resourceData)
        .returning()
      if (!created) throw new Error("Failed to insert resource row")

      await tx.insert(resourceContent).values({
        resourceId: created.id,
        content,
      })

      return created
    })
  }

  const [created] = await db
    .insert(resource)
    .values(resourceData)
    .returning()
  if (!created) throw new Error("Failed to insert resource row")
  return created
}

export async function updateResource(
  id: string,
  projectId: string,
  organizationId: string,
  input: {
    title?: string
    category?: ResourceCategory
    linkUrl?: string
    fileUrl?: string
    fileName?: string
    fileMimeType?: string
    fileSize?: number
    content?: Record<string, unknown>
  },
) {
  const { content, ...resourceData } = input

  const hasResourceUpdates = Object.values(resourceData).some(
    (v) => v !== undefined,
  )

  return await db.transaction(async (tx) => {
    if (hasResourceUpdates) {
      await tx
        .update(resource)
        .set(resourceData)
        .where(
          and(
            eq(resource.id, id),
            eq(resource.projectId, projectId),
            eq(resource.organizationId, organizationId),
          ),
        )
    }

    if (content !== undefined) {
      await tx
        .update(resourceContent)
        .set({ content })
        .where(eq(resourceContent.resourceId, id))
    }

    return { id }
  })
}

export async function deleteResource(
  id: string,
  projectId: string,
  organizationId: string,
) {
  const [deleted] = await db
    .delete(resource)
    .where(
      and(
        eq(resource.id, id),
        eq(resource.projectId, projectId),
        eq(resource.organizationId, organizationId),
      ),
    )
    .returning({
      id: resource.id,
      type: resource.type,
      fileUrl: resource.fileUrl,
    })
  return deleted ?? null
}

export async function getProjectStorageUsage(projectId: string) {
  const [result] = await db
    .select({
      totalSize: sql<number>`coalesce(sum(${resource.fileSize}), 0)`,
    })
    .from(resource)
    .where(
      and(eq(resource.projectId, projectId), eq(resource.type, "file")),
    )
  return result?.totalSize ?? 0
}
