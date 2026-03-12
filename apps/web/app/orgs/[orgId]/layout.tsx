"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { authClient } from "@workspace/auth/client"

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ orgId: string }>()
  const orgId = params.orgId

  // Set active org when navigating to org pages
  useEffect(() => {
    if (orgId) {
      void authClient.organization.setActive({ organizationId: orgId })
    }
  }, [orgId])

  return <>{children}</>
}
