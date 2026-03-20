"use client"

import Link from "next/link"
import { Logo } from "@/components/logo"
import { UserDropdown } from "@/components/user-menu"

export function SimpleHeader() {
  return (
    <div className="flex h-11 items-center justify-between border-b border-border bg-background px-3 md:px-4 lg:px-6">
      <Link href="/orgs" className="transition-opacity hover:opacity-80">
        <Logo
          variant="full"
          iconClassName="h-5 w-5 md:h-6 md:w-6"
          textClassName="text-base md:text-lg"
          className="gap-1"
        />
      </Link>
      <UserDropdown size="icon" />
    </div>
  )
}
