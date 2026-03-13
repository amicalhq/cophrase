"use client"

import { authClient } from "@workspace/auth/client"
import { useProject } from "../project-context"
import { TopNavigation } from "@/components/navigation/top-navigation"

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { project } = useProject()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined

  return (
    <div className="bg-background flex h-screen flex-col">
      <TopNavigation organization={organization} project={project} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
