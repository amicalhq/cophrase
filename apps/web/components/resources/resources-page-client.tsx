"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { ResourceGrid } from "./resource-grid"
import { ResourceDialog } from "./resource-dialog"
import type { ResourceType, ResourceCategory } from "@workspace/db"

interface ResourceRow {
  id: string
  title: string
  type: ResourceType
  category: ResourceCategory
  linkUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  fileMimeType?: string | null
  updatedAt: string
}

interface ResourcesPageClientProps {
  resources: ResourceRow[]
  orgId: string
  projectId: string
}

export function ResourcesPageClient({
  resources,
  orgId,
  projectId,
}: ResourcesPageClientProps) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Resources</h1>
          <p className="text-muted-foreground text-sm">
            Manage inputs for your content agents
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add resource
        </Button>
      </div>
      <ResourceGrid
        resources={resources}
        orgId={orgId}
        projectId={projectId}
        onAddClick={() => setCreateOpen(true)}
      />
      <ResourceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={orgId}
        projectId={projectId}
      />
    </>
  )
}
