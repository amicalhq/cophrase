"use client"

import { authClient } from "@workspace/auth/client"
import { TopNavigation } from "@/components/navigation/top-navigation"
import { TabNavigation } from "@/components/navigation/tab-navigation"

interface OrgNavLayoutClientProps {
  orgId: string
  children: React.ReactNode
}

export function OrgNavLayoutClient({
  orgId,
  children,
}: OrgNavLayoutClientProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined

  const orgTabs = [
    { label: "Projects", href: `/orgs/${orgId}/projects` },
    { label: "Settings", href: `/orgs/${orgId}/settings` },
  ]

  return (
    <div className="bg-background min-h-screen">
      <TopNavigation organization={organization} />
      <TabNavigation tabs={orgTabs} />
      {children}
    </div>
  )
}
