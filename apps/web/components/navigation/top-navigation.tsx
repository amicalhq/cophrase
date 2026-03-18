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
import {
  Menu01Icon,
  HelpCircleIcon,
  Activity01Icon,
  AiSearchIcon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons"
import { Logo } from "@/components/logo"
import { OrgProjectPicker } from "./org-project-picker"
import { UserDropdown } from "@/components/user-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

interface TopNavigationProps {
  organization?: { id: string; name: string; logo?: string | null }
  project?: { id: string; name: string }
  pageTitle?: string
}

export function TopNavigation({
  organization,
  project,
  pageTitle,
}: TopNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const hasOrg = !!organization?.id
  const hasProject = !!project?.id && !!project.name
  const deepestLevel = hasProject ? "project" : hasOrg ? "org" : "none"

  return (
    <div className="bg-background border-border border-b">
      <div className="flex h-11 items-center justify-between px-3 md:px-4 lg:px-6">
        {/* Left side — Logo and Breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-1.5 lg:gap-2">
          <Link
            href="/orgs"
            className="mr-1 hidden transition-opacity hover:opacity-80 md:block"
          >
            <Logo variant="icon" iconClassName="text-lg leading-none" className="gap-0" />
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
                  showText={deepestLevel === "project" && !pageTitle}
                />
              </>
            )}
            {pageTitle && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span className="truncate text-sm font-medium">{pageTitle}</span>
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
            {pageTitle && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-sm font-medium">{pageTitle}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Desktop actions */}
          <div className="hidden items-center gap-1.5 md:flex lg:gap-2">
            <HelpMenu />
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
                  <Link
                    href="/orgs"
                    className="text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Organizations
                  </Link>
                  {hasOrg && (
                    <Link
                      href={`/orgs/${organization!.id}/projects`}
                      className="text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Projects
                    </Link>
                  )}
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

const isDev = process.env.NODE_ENV === "development"

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HugeiconsIcon icon={HelpCircleIcon} size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Help</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://cophrase.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-2"
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={14} />
            Documentation
          </a>
        </DropdownMenuItem>
        {isDev && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Dev Tools
            </DropdownMenuLabel>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem asChild>
                    <a
                      href="http://localhost:3456?resource=run"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <HugeiconsIcon icon={Activity01Icon} size={14} />
                      Workflow Dashboard
                    </a>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <code className="text-[10px]">
                    npx workflow web --backend @workflow/world-postgres
                  </code>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem asChild>
                    <a
                      href="http://localhost:4983"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <HugeiconsIcon icon={AiSearchIcon} size={14} />
                      AI SDK DevTools
                    </a>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <code className="text-[10px]">
                    npx @ai-sdk/devtools
                  </code>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
