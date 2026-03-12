import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"
import { ProjectLayoutClient } from "./project-layout-client"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) redirect("/orgs")

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) notFound()

  return (
    <ProjectLayoutClient orgId={orgId} project={project}>
      {children}
    </ProjectLayoutClient>
  )
}
