"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import type { ModelRow } from "./models-page"

const columnHelper = createColumnHelper<ModelRow>()

const modelTypeBadgeColors: Record<string, string> = {
  language: "bg-blue-500/10 text-blue-500",
  embedding: "bg-yellow-500/10 text-yellow-500",
  image: "bg-green-500/10 text-green-500",
  video: "bg-purple-500/10 text-purple-500",
}

export const modelsColumns = [
  columnHelper.accessor("modelId", {
    header: "Model",
    size: 300,
    cell: (info) => (
      <span className="block truncate font-medium">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("providerName", {
    header: "Provider",
    size: 200,
    cell: (info) => {
      const providerType = info.row.original.providerType
      return (
        <span className="inline-flex items-center gap-2">
          <Avatar className="h-4 w-4 rounded-sm">
            <AvatarImage
              src={`https://models.dev/logos/${providerType === "ai-gateway" ? "vercel" : providerType}.svg`}
              className="dark:invert"
            />
            <AvatarFallback className="rounded-sm text-[8px]">
              {info.getValue().charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span>{info.getValue()}</span>
        </span>
      )
    },
  }),
  columnHelper.accessor("modelType", {
    header: "Type",
    size: 120,
    cell: (info) => {
      const type = info.getValue()
      return (
        <Badge
          variant="secondary"
          className={`h-6 px-2.5 text-xs ${modelTypeBadgeColors[type] ?? ""}`}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Badge>
      )
    },
  }),
  columnHelper.accessor("isDefault", {
    header: "Default",
    size: 80,
    cell: (info) => (
      <span
        className={`text-base ${info.getValue() ? "text-yellow-500" : "text-muted-foreground/30 cursor-pointer hover:text-yellow-500/50"}`}
      >
        {info.getValue() ? "★" : "☆"}
      </span>
    ),
  }),
]
