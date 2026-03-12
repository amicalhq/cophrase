"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { ContentType, ContentStage } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"

export type ContentRow = {
  id: string
  title: string
  type: ContentType
  stage: ContentStage
  creatorName: string | null
  updatedAt: string
}

const stageColors: Record<ContentRow["stage"], string> = {
  idea: "bg-muted text-muted-foreground",
  draft: "bg-blue-500/10 text-blue-500",
  review: "bg-yellow-500/10 text-yellow-500",
  ready: "bg-green-500/10 text-green-500",
  published: "bg-purple-500/10 text-purple-500",
}

const typeColors: Record<ContentRow["type"], string> = {
  blog: "bg-blue-500/10 text-blue-500",
  social: "bg-purple-500/10 text-purple-500",
}

const typeLabels: Record<ContentRow["type"], string> = {
  blog: "Blog",
  social: "Social",
}

const stageLabels: Record<ContentRow["stage"], string> = {
  idea: "Idea",
  draft: "Draft",
  review: "Review",
  ready: "Ready",
  published: "Published",
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export const columns: ColumnDef<ContentRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    size: 1000,
    cell: ({ row }) => (
      <span className="block truncate font-medium">{row.getValue("title")}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    size: 100,
    cell: ({ row }) => {
      const type = row.getValue("type") as ContentRow["type"]
      return (
        <Badge variant="secondary" className={`h-6 px-2.5 text-xs ${typeColors[type]}`}>
          {typeLabels[type]}
        </Badge>
      )
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "stage",
    header: "Stage",
    size: 110,
    cell: ({ row }) => {
      const stage = row.getValue("stage") as ContentRow["stage"]
      return (
        <Badge variant="secondary" className={`h-6 px-2.5 text-xs ${stageColors[stage]}`}>
          {stageLabels[stage]}
        </Badge>
      )
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "creatorName",
    header: "Created by",
    size: 120,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("creatorName") ?? "Unknown"}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    size: 130,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatRelativeTime(row.getValue("updatedAt"))}
      </span>
    ),
  },
]
