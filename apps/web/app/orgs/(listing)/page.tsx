"use client"

import Link from "next/link"
import { authClient } from "@workspace/auth/client"
import { Button } from "@workspace/ui/components/button"
import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"

export default function OrgsPage() {
  const { data: orgs, isPending, error } = authClient.useListOrganizations()

  if (isPending) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground text-sm">
          Loading organizations...
        </p>
      </main>
    )
  }

  if (error || !orgs) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground text-sm">
          Failed to load organizations. Please try refreshing the page.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <Link href="/sign-up/org">
          <Button size="sm">Create Organization</Button>
        </Link>
      </div>
      <div className="space-y-2">
        {orgs.map((org) => (
          <Link
            key={org.id}
            href={`/orgs/${org.id}/projects`}
            className="border-border hover:bg-accent flex items-center gap-3 rounded-md border p-3 transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {org.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-muted-foreground text-xs">{org.slug}</p>
            </div>
          </Link>
        ))}
        {orgs.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No organizations yet.{" "}
            <Link href="/sign-up/org" className="text-primary underline">
              Create one
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  )
}
