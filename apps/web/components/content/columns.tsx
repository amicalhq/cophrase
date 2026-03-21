"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, Delete02Icon } from "@hugeicons/core-free-icons"

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

export function createColumns(
  onDelete: (row: ContentRow) => void,
): ColumnDef<ContentRow>[] {
  return [
    {
      id: "select",
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          onClick={(e) => e.stopPropagation()}
          className="border-muted-foreground/40 data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=indeterminate]:bg-foreground data-[state=indeterminate]:text-background"
        />
      ),
      cell: ({ row }) => (
        <div
          className={cn(
            "transition-opacity",
            row.getIsSelected()
              ? "opacity-100"
              : "opacity-0 group-hover/row:opacity-100",
          )}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
            className="border-muted-foreground/40 data-[state=checked]:bg-foreground data-[state=checked]:text-background"
          />
        </div>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      size: 1000,
      cell: ({ row }) => (
        <span className="block truncate font-medium">
          {row.getValue("title")}
        </span>
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
    {
      id: "actions",
      size: 48,
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => e.stopPropagation()}
            >
              <HugeiconsIcon
                icon={MoreHorizontalIcon}
                className="size-4"
                strokeWidth={2}
              />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(row.original)}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                className="mr-2 size-4"
                strokeWidth={2}
              />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
