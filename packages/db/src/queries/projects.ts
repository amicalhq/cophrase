import { eq, and } from "drizzle-orm"
import { db } from "../index"
import { project } from "../schema/projects"
import { member } from "../schema/auth"

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

export async function isOrgMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [result] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
      ),
    )
  return !!result
}
