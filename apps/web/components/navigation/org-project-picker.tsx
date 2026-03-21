"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { authClient } from "@workspace/auth/client"
import { trpc } from "@/lib/trpc/client"

interface OrgProjectPickerProps {
  organization?: { id: string; name: string; logo?: string | null }
  project?: { id: string; name: string }
  triggerType: "org" | "project"
  showText?: boolean
}

interface ProjectItem {
  id: string
  name: string
  organizationId: string
}

export function OrgProjectPicker({
  organization,
  project,
  triggerType,
  showText = false,
}: OrgProjectPickerProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [orgSearch, setOrgSearch] = React.useState("")
  const [projectSearch, setProjectSearch] = React.useState("")
  const [selectedOrgId, setSelectedOrgId] = React.useState(
    organization?.id ?? ""
  )
  const orgInputRef = React.useRef<HTMLInputElement>(null)
  const projectInputRef = React.useRef<HTMLInputElement>(null)

  // Fetch orgs from Better Auth
  const { data: orgsData, isPending: orgsLoading } =
    authClient.useListOrganizations()

  // Fetch projects for selected org
  const { data: projectsData, isLoading: projectsLoading } =
    trpc.projects.list.useQuery(
      { orgId: selectedOrgId },
      { enabled: open && !!selectedOrgId }
    )

  const projects: ProjectItem[] = projectsData ?? []

  // Sync selectedOrgId when organization prop changes
  React.useEffect(() => {
    if (organization?.id) {
      setSelectedOrgId(organization.id)
    }
  }, [organization?.id])

  React.useEffect(() => {
    if (!open) {
      // Clear search filters when popover closes
      setOrgSearch("")
      setProjectSearch("")
    }
  }, [open])

  const allOrganizations =
    orgsData?.map((org) => ({
      id: org.id,
      name: org.name,
      logo: org.logo,
    })) ?? []

  const filteredOrgs = allOrganizations.filter((org) =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase())
  )

  const filteredProjects = projects.filter((proj) =>
    proj.name.toLowerCase().includes(projectSearch.toLowerCase())
  )

  // Loading skeleton
  if (!organization) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="hidden h-4 w-20 md:block" />
      </div>
    )
  }
  if (triggerType === "project" && !project) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="hidden h-4 w-24 md:block" />
      </div>
    )
  }

  const handleOrgClick = (org: { id: string }) => {
    setSelectedOrgId(org.id)
  }

  const handleProjectClick = (proj: ProjectItem) => {
    const selectedOrg = allOrganizations.find((o) => o.id === selectedOrgId)
    if (selectedOrg) {
      setOpen(false)
      router.push(`/orgs/${selectedOrg.id}/projects/${proj.id}/content`)
    }
  }

  const org = organization

  const entityAvatar = (
    entity: { name: string },
    shape: "rounded-full" | "rounded-md"
  ) => (
    <Avatar className={cn("h-6 w-6", shape)}>
      <AvatarFallback className="text-xs">
        {entity.name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )

  const pickerPopoverContent = (
    <div className="flex h-[450px]">
      {/* Left Column — Organizations */}
      <div className="flex flex-1 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <Input
            ref={orgInputRef}
            placeholder="Find Organization..."
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            className="bg-card"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-1 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Organizations
          </div>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-5 w-5" />
            </div>
          ) : (
            <div
              role="listbox"
              aria-label="Organizations"
              className="space-y-1"
            >
              {filteredOrgs.map((o) => (
                <button
                  key={o.id}
                  role="option"
                  aria-selected={o.id === selectedOrgId}
                  onClick={() => handleOrgClick(o)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                    o.id === selectedOrgId && "bg-accent"
                  )}
                >
                  {entityAvatar(o, "rounded-full")}
                  <span className="flex-1 truncate text-foreground">
                    {o.name}
                  </span>
                  {o.id === selectedOrgId && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="flex-shrink-0 text-foreground"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column — Projects */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border p-3">
          <Input
            ref={projectInputRef}
            placeholder="Find Project..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            className="bg-card"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-1 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Projects
          </div>
          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-5 w-5" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              No projects yet
            </div>
          ) : (
            <div role="listbox" aria-label="Projects" className="space-y-1">
              {filteredProjects.map((proj) => (
                <button
                  key={proj.id}
                  role="option"
                  aria-selected={proj.id === project?.id}
                  onClick={() => handleProjectClick(proj)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                    proj.id === project?.id && "bg-accent"
                  )}
                >
                  {entityAvatar(proj, "rounded-md")}
                  <span className="flex-1 truncate text-foreground">
                    {proj.name}
                  </span>
                  {proj.id === project?.id && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="flex-shrink-0 text-foreground"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const chevronButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Switch organization or project"
      className="h-8 w-6 rounded-l-none px-0 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
    </Button>
  )

  if (triggerType === "org") {
    return (
      <div className="flex items-center">
        {/* Mobile: icon-only link */}
        <Link
          href={`/orgs/${org.id}/projects`}
          className="flex h-8 items-center rounded-md px-1.5 text-foreground hover:bg-accent md:hidden"
        >
          {entityAvatar(org, "rounded-full")}
          {showText && (
            <span className="ml-1.5 max-w-[120px] truncate text-sm text-foreground">
              {org.name}
            </span>
          )}
        </Link>

        {/* Desktop: link + popover chevron */}
        <div className="hidden items-center md:flex">
          <Link
            href={`/orgs/${org.id}/projects`}
            className="mx-0 flex h-8 max-w-[150px] items-center gap-2 rounded-l-md px-2 text-foreground hover:bg-accent lg:max-w-[180px]"
          >
            {entityAvatar(org, "rounded-full")}
            <span className="truncate text-sm">{org.name}</span>
          </Link>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{chevronButton}</PopoverTrigger>
            <PopoverContent
              className="w-[550px] overflow-hidden border-border bg-background p-0"
              align="start"
              sideOffset={8}
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                orgInputRef.current?.focus()
              }}
            >
              {pickerPopoverContent}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    )
  }

  // Project trigger
  return (
    <div className="flex items-center">
      {/* Mobile */}
      <Link
        href={`/orgs/${org.id}/projects/${project?.id}/content`}
        className="flex h-8 items-center rounded-md px-1.5 text-foreground hover:bg-accent md:hidden"
      >
        {entityAvatar(project as { id: string; name: string }, "rounded-md")}
        {showText && (
          <span className="ml-1.5 max-w-[120px] truncate text-sm text-foreground">
            {project?.name}
          </span>
        )}
      </Link>

      {/* Desktop */}
      <div className="hidden items-center md:flex">
        <Link
          href={`/orgs/${org.id}/projects/${project?.id}/content`}
          className="flex h-8 max-w-[150px] items-center gap-2 rounded-l-md px-2 text-foreground hover:bg-accent lg:max-w-[180px]"
        >
          {entityAvatar(project as { id: string; name: string }, "rounded-md")}
          <span className="truncate text-sm">{project?.name}</span>
        </Link>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{chevronButton}</PopoverTrigger>
          <PopoverContent
            className="w-[550px] overflow-hidden border-border bg-background p-0"
            align="start"
            sideOffset={8}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              projectInputRef.current?.focus()
            }}
          >
            {pickerPopoverContent}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
