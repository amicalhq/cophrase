"use client"

import { useState, useMemo } from "react"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Button } from "@workspace/ui/components/button"
import type { ResourceType, ResourceCategory } from "@workspace/db"
import { ResourceCard } from "./resource-card"
import { ResourceDialog } from "./resource-dialog"
import type { JSONContent } from "@tiptap/react"
import { trpc } from "@/lib/trpc/client"

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

interface ResourceGridProps {
  resources: ResourceRow[]
  orgId: string
  projectId: string
  onAddClick: () => void
}

const categoryOptions: { value: ResourceCategory; label: string }[] = [
  { value: "brand_voice", label: "Brand Voice" },
  { value: "product_features", label: "Product Features" },
  { value: "visual_identity", label: "Visual Identity" },
  { value: "documentation", label: "Documentation" },
  { value: "competitor_info", label: "Competitor Info" },
  { value: "target_audience", label: "Target Audience" },
  { value: "website", label: "Website" },
  { value: "target_keywords", label: "Target Keywords" },
  { value: "seo_guidelines", label: "SEO Guidelines" },
  { value: "style_guide", label: "Style Guide" },
  { value: "writing_examples", label: "Writing Examples" },
  { value: "internal_links", label: "Internal Links" },
  { value: "other", label: "Other" },
]

const typeOptions: { value: ResourceType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
]

export function ResourceGrid({
  resources,
  orgId,
  projectId,
  onAddClick,
}: ResourceGridProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [editResource, setEditResource] = useState<{
    id: string
    title: string
    type: ResourceType
    category: ResourceCategory
    linkUrl?: string | null
    fileName?: string | null
    content?: JSONContent | null
  } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const utils = trpc.useUtils()

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false
      if (categoryFilter !== "all" && r.category !== categoryFilter)
        return false
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()))
        return false
      return true
    })
  }, [resources, typeFilter, categoryFilter, search])

  async function handleCardClick(r: ResourceRow) {
    try {
      const raw = await utils.resources.get.fetch({
        orgId,
        id: r.id,
        projectId,
      })
      const data = raw as Record<string, unknown>
      setEditResource({
        id: data.id as string,
        title: data.title as string,
        type: data.type as ResourceType,
        category: data.category as ResourceCategory,
        linkUrl: (data.linkUrl as string | null) ?? null,
        fileName: (data.fileName as string | null) ?? null,
        content: (data.content as JSONContent) ?? null,
      })
      setEditOpen(true)
    } catch {
      // silently fail, user can retry
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
          <p>No resources found</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onAddClick}
          >
            Add your first resource
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              {...r}
              onClick={() => handleCardClick(r)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <ResourceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orgId={orgId}
        projectId={projectId}
        editResource={editResource}
      />
    </div>
  )
}
