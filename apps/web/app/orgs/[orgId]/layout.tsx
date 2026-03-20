"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { authClient } from "@workspace/auth/client"

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ orgId: string }>()
  const orgId = params.orgId

  // Set active org when navigating to org pages
  // Only set if Better Auth confirms membership; redirect on failure
  useEffect(() => {
    if (orgId) {
      authClient.organization
        .setActive({ organizationId: orgId })
        .then((res) => {
          if (res.error) {
            window.location.href = "/orgs"
          }
        })
        .catch(() => {
          window.location.href = "/orgs"
        })
    }
  }, [orgId])

  return <>{children}</>
}
