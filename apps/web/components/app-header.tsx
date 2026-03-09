"use client"

import { authClient } from "@workspace/auth/client"
import { UserMenu } from "@/components/user-menu"

export function AppHeader() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  return (
    <header className="border-border flex h-12 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {activeOrg?.name ?? "CoPhrase"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  )
}
