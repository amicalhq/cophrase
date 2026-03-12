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
import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { authClient } from "@workspace/auth/client"

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
    organization?.id ?? "",
  )
  const orgInputRef = React.useRef<HTMLInputElement>(null)
  const projectInputRef = React.useRef<HTMLInputElement>(null)

  // Fetch orgs from Better Auth
  const { data: orgsData, isPending: orgsLoading } =
    authClient.useListOrganizations()

  // Fetch projects for selected org
  const [projects, setProjects] = React.useState<ProjectItem[]>([])
  const [projectsLoading, setProjectsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !selectedOrgId) return
    const controller = new AbortController()
    setProjectsLoading(true)
    fetch(`/api/projects?orgId=${selectedOrgId}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ProjectItem[]) => setProjects(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setProjects([])
      })
      .finally(() => setProjectsLoading(false))
    return () => controller.abort()
  }, [open, selectedOrgId])

  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (triggerType === "org") {
          orgInputRef.current?.focus()
        } else {
          projectInputRef.current?.focus()
        }
      }, 0)
    } else if (organization) {
      setSelectedOrgId(organization.id)
    }
  }, [open, triggerType, organization])

  const allOrganizations =
    orgsData?.map((org) => ({
      id: org.id,
      name: org.name,
      logo: org.logo,
    })) ?? []

  const filteredOrgs = allOrganizations.filter((org) =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase()),
  )

  const filteredProjects = projects.filter((proj) =>
    proj.name.toLowerCase().includes(projectSearch.toLowerCase()),
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
      router.push(`/orgs/${selectedOrg.id}/projects/${proj.id}/overview`)
    }
  }

  const org = organization

  const entityAvatar = (
    entity: { name: string },
    shape: "rounded-full" | "rounded-md",
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
      <div className="border-border flex flex-1 flex-col border-r">
        <div className="border-border border-b p-3">
          <Input
            ref={orgInputRef}
            placeholder="Find Organization..."
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            className="bg-card"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-muted-foreground mb-1 px-2 py-1.5 text-xs font-medium">
            Organizations
          </div>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-5 w-5" />
            </div>
          ) : (
            <div role="listbox" aria-label="Organizations" className="space-y-1">
              {filteredOrgs.map((o) => (
                <button
                  key={o.id}
                  role="option"
                  aria-selected={o.id === selectedOrgId}
                  onClick={() => handleOrgClick(o)}
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    o.id === selectedOrgId && "bg-accent",
                  )}
                >
                  {entityAvatar(o, "rounded-full")}
                  <span className="text-foreground flex-1 truncate">
                    {o.name}
                  </span>
                  {o.id === selectedOrgId && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-foreground flex-shrink-0"
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
        <div className="border-border border-b p-3">
          <Input
            ref={projectInputRef}
            placeholder="Find Project..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            className="bg-card"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-muted-foreground mb-1 px-2 py-1.5 text-xs font-medium">
            Projects
          </div>
          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-5 w-5" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-muted-foreground px-2 py-2 text-sm">
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
                    "hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    proj.id === project?.id && "bg-accent",
                  )}
                >
                  {entityAvatar(proj, "rounded-md")}
                  <span className="text-foreground flex-1 truncate">
                    {proj.name}
                  </span>
                  {proj.id === project?.id && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-foreground flex-shrink-0"
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
      className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-6 rounded-l-none px-0"
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
          className="text-foreground hover:bg-accent flex h-8 items-center rounded-md px-1.5 md:hidden"
        >
          {entityAvatar(org, "rounded-full")}
          {showText && (
            <span className="text-foreground ml-1.5 max-w-[120px] truncate text-sm">
              {org.name}
            </span>
          )}
        </Link>

        {/* Desktop: link + popover chevron */}
        <div className="hidden items-center md:flex">
          <Link
            href={`/orgs/${org.id}/projects`}
            className="text-foreground hover:bg-accent mx-0 flex h-8 max-w-[150px] items-center gap-2 rounded-l-md px-2 lg:max-w-[180px]"
          >
            {entityAvatar(org, "rounded-full")}
            <span className="truncate text-sm">{org.name}</span>
          </Link>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{chevronButton}</PopoverTrigger>
            <PopoverContent
              className="border-border bg-background w-[550px] overflow-hidden p-0"
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
        href={`/orgs/${org.id}/projects/${project?.id}/overview`}
        className="text-foreground hover:bg-accent flex h-8 items-center rounded-md px-1.5 md:hidden"
      >
        {entityAvatar(project as { id: string; name: string }, "rounded-md")}
        {showText && (
          <span className="text-foreground ml-1.5 max-w-[120px] truncate text-sm">
            {project?.name}
          </span>
        )}
      </Link>

      {/* Desktop */}
      <div className="hidden items-center md:flex">
        <Link
          href={`/orgs/${org.id}/projects/${project?.id}/overview`}
          className="text-foreground hover:bg-accent flex h-8 max-w-[150px] items-center gap-2 rounded-l-md px-2 lg:max-w-[180px]"
        >
          {entityAvatar(project as { id: string; name: string }, "rounded-md")}
          <span className="truncate text-sm">{project?.name}</span>
        </Link>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{chevronButton}</PopoverTrigger>
          <PopoverContent
            className="border-border bg-background w-[550px] overflow-hidden p-0"
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
