"use client"

import { authClient } from "@workspace/auth/client"
import { TopNavigation } from "@/components/navigation/top-navigation"
import { TabNavigation } from "@/components/navigation/tab-navigation"

interface ProjectLayoutClientProps {
  orgId: string
  project: { id: string; name: string }
  children: React.ReactNode
}

export function ProjectLayoutClient({
  orgId,
  project,
  children,
}: ProjectLayoutClientProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined

  const projectTabs = [
    {
      label: "Content",
      href: `/orgs/${orgId}/projects/${project.id}/content`,
    },
    {
      label: "Agents",
      href: `/orgs/${orgId}/projects/${project.id}/agents`,
    },
    {
      label: "Resources",
      href: `/orgs/${orgId}/projects/${project.id}/resources`,
    },
    {
      label: "Settings",
      href: `/orgs/${orgId}/projects/${project.id}/settings`,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation organization={organization} project={project} />
      <TabNavigation tabs={projectTabs} />
      {children}
    </div>
  )
}
