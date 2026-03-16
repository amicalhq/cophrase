import { eq, and, desc, asc } from "drizzle-orm"
import { db } from "../index"
import { artifact } from "../schema/artifacts"
import type { ArtifactStatus } from "../schema/enums"

export async function getArtifactsByRun(runId: string) {
  return await db
    .select()
    .from(artifact)
    .where(eq(artifact.runId, runId))
    .orderBy(asc(artifact.createdAt))
}

export async function getArtifactsByContent(contentId: string) {
  return await db
    .select()
    .from(artifact)
    .where(eq(artifact.contentId, contentId))
    .orderBy(desc(artifact.createdAt))
}

export async function getArtifactsSummaryByContent(contentId: string) {
  return await db
    .select({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title,
      version: artifact.version,
      status: artifact.status,
      createdAt: artifact.createdAt,
    })
    .from(artifact)
    .where(eq(artifact.contentId, contentId))
    .orderBy(desc(artifact.createdAt))
}

export async function getArtifactById(id: string) {
  const [result] = await db
    .select()
    .from(artifact)
    .where(eq(artifact.id, id))
  return result ?? null
}

export async function createArtifact(input: {
  organizationId: string
  projectId: string
  contentId?: string
  agentId: string
  runId: string
  type: string
  title: string
  data: unknown
  version?: number
  status?: ArtifactStatus
  parentIds?: string[]
}) {
  const [result] = await db.insert(artifact).values(input).returning()
  if (!result) throw new Error("Failed to insert artifact row")
  return result
}

export async function updateArtifactStatus(id: string, status: ArtifactStatus) {
  const [result] = await db
    .update(artifact)
    .set({ status })
    .where(eq(artifact.id, id))
    .returning()
  return result ?? null
}

export async function searchArtifacts(filters: {
  organizationId: string
  contentId?: string
  runId?: string
  type?: string
  status?: ArtifactStatus
}) {
  const conditions = [eq(artifact.organizationId, filters.organizationId)]
  if (filters.contentId)
    conditions.push(eq(artifact.contentId, filters.contentId))
  if (filters.runId) conditions.push(eq(artifact.runId, filters.runId))
  if (filters.type) conditions.push(eq(artifact.type, filters.type))
  if (filters.status) conditions.push(eq(artifact.status, filters.status))

  return await db
    .select({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title,
      version: artifact.version,
      status: artifact.status,
      createdAt: artifact.createdAt,
    })
    .from(artifact)
    .where(and(...conditions))
    .orderBy(desc(artifact.createdAt))
}

export async function getNextArtifactVersion(
  contentId: string,
  type: string,
): Promise<number> {
  const [latest] = await db
    .select({ version: artifact.version })
    .from(artifact)
    .where(and(eq(artifact.contentId, contentId), eq(artifact.type, type)))
    .orderBy(desc(artifact.version))
    .limit(1)
  return (latest?.version ?? 0) + 1
}
