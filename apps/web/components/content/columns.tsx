"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"

export type ContentRow = {
  id: string
  title: string
  contentTypeName: string | null
  currentStageName: string | null
  creatorName: string | null
  updatedAt: string
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
    accessorKey: "contentTypeName",
    header: "Type",
    size: 100,
    cell: ({ row }) => {
      const typeName = row.getValue("contentTypeName") as string | null
      return typeName ? (
        <Badge variant="secondary" className="h-6 px-2.5 text-xs">
          {typeName}
        </Badge>
      ) : null
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "currentStageName",
    header: "Stage",
    size: 110,
    cell: ({ row }) => {
      const stageName = row.getValue("currentStageName") as string | null
      return stageName ? (
        <Badge variant="secondary" className="h-6 px-2.5 text-xs">
          {stageName}
        </Badge>
      ) : null
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
