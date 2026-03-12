import { db } from "@workspace/db"
import { project } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

export async function getProjectsByOrg(organizationId: string) {
  return await db
    .select()
    .from(project)
    .where(eq(project.organizationId, organizationId))
}

export async function getProjectById(id: string) {
  const [result] = await db
    .select()
    .from(project)
    .where(eq(project.id, id))
  return result ?? null
}
