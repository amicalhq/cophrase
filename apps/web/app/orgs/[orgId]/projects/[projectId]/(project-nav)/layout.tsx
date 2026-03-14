"use client"

import { useProject } from "../project-context"
import { ProjectLayoutClient } from "../project-layout-client"

export default function ProjectNavLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgId, project } = useProject()

  return (
    <ProjectLayoutClient orgId={orgId} project={project}>
      {children}
    </ProjectLayoutClient>
  )
}
