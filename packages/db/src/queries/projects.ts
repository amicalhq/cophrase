import { eq, and } from "drizzle-orm"
import { db } from "../index"
import { project } from "../schema/projects"
import { organization, member } from "../schema/auth"

export async function getProjectsByOrg(organizationId: string) {
  return await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
    })
    .from(project)
    .where(eq(project.organizationId, organizationId))
}

export async function createProject(input: {
  name: string
  description?: string
  organizationId: string
}) {
  const [created] = await db
    .insert(project)
    .values({
      name: input.name,
      description: input.description ?? null,
      organizationId: input.organizationId,
    })
    .returning({
      id: project.id,
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
    })
  return created
}

export async function getProjectByIdAndOrg(
  id: string,
  organizationId: string,
) {
  const [result] = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.organizationId, organizationId)))
  return result ?? null
}

export async function getOrganizationsByUser(userId: string) {
  return await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
    })
    .from(organization)
    .innerJoin(member, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
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
