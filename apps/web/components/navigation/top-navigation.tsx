"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { Logo } from "@/components/logo"
import { OrgProjectPicker } from "./org-project-picker"
import { UserDropdown } from "@/components/user-menu"

interface TopNavigationProps {
  organization?: { id: string; name: string; logo?: string | null }
  project?: { id: string; name: string }
}

export function TopNavigation({
  organization,
  project,
}: TopNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const hasOrg = !!organization?.id
  const hasProject = !!project?.id && !!project.name
  const deepestLevel = hasProject ? "project" : hasOrg ? "org" : "none"

  return (
    <div className="bg-background">
      <div className="flex h-11 items-center justify-between px-3 md:px-4 lg:px-6">
        {/* Left side — Logo and Breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-1.5 lg:gap-2">
          <Link
            href="/orgs"
            className="mr-1 hidden transition-opacity hover:opacity-80 md:block"
          >
            <Logo variant="icon" iconClassName="h-5 w-5" className="gap-0" />
          </Link>
          <span className="text-muted-foreground/50 hidden md:block">/</span>

          {/* Mobile breadcrumbs */}
          <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
            {hasOrg && (
              <OrgProjectPicker
                organization={organization}
                project={project}
                triggerType="org"
                showText={deepestLevel === "org"}
              />
            )}
            {hasProject && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <OrgProjectPicker
                  organization={organization}
                  project={project}
                  triggerType="project"
                  showText={deepestLevel === "project"}
                />
              </>
            )}
          </div>

          {/* Desktop breadcrumbs */}
          <div className="hidden items-center gap-1.5 md:flex lg:gap-2">
            {hasOrg && (
              <OrgProjectPicker
                organization={organization}
                project={project}
                triggerType="org"
              />
            )}
            {hasProject && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <OrgProjectPicker
                  organization={organization}
                  project={project}
                  triggerType="project"
                />
              </>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Desktop actions */}
          <div className="hidden items-center gap-1.5 md:flex lg:gap-2">
            <UserDropdown size="icon" />
          </div>

          {/* Mobile hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent md:hidden"
              >
                <HugeiconsIcon icon={Menu01Icon} size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] px-4">
              <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col gap-2">
                  {/* Add more mobile menu items here as the app grows */}
                </div>
                <div className="mt-auto pt-4">
                  <UserDropdown size="full" className="w-full" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  )
}
