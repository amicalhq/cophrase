import { getProjectById } from "@/lib/data/projects"
import { ProjectLayoutClient } from "./project-layout-client"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const project = await getProjectById(projectId)

  return (
    <ProjectLayoutClient orgId={orgId} project={project}>
      {children}
    </ProjectLayoutClient>
  )
}
