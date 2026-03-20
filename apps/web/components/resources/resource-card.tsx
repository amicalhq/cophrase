"use client"

import { Badge } from "@workspace/ui/components/badge"
import type { ResourceType, ResourceCategory } from "@workspace/db"

interface ResourceCardProps {
  id: string
  title: string
  type: ResourceType
  category: ResourceCategory
  linkUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  fileMimeType?: string | null
  updatedAt: string
  onClick?: () => void
}

const typeIcons: Record<ResourceType, string> = {
  text: "📝",
  link: "🔗",
  file: "📄",
}

function getFileIcon(mimeType?: string | null): string {
  if (mimeType?.startsWith("image/")) return "🖼️"
  return "📄"
}

const categoryLabels: Record<ResourceCategory, string> = {
  brand_voice: "Brand Voice",
  product_features: "Product Features",
  visual_identity: "Visual Identity",
  documentation: "Documentation",
  competitor_info: "Competitor Info",
  target_audience: "Target Audience",
  website: "Website",
  other: "Other",
}

const categoryVariants: Record<ResourceCategory, string> = {
  brand_voice: "bg-green-500/10 text-green-500",
  product_features: "bg-yellow-500/10 text-yellow-500",
  visual_identity: "bg-purple-500/10 text-purple-500",
  documentation: "bg-blue-500/10 text-blue-500",
  competitor_info: "bg-red-500/10 text-red-500",
  target_audience: "bg-orange-500/10 text-orange-500",
  website: "bg-cyan-500/10 text-cyan-500",
  other: "bg-gray-500/10 text-gray-500",
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const typeLabels: Record<ResourceType, string> = {
  text: "Text",
  link: "Link",
  file: "File",
}

export function ResourceCard({
  title,
  type,
  category,
  linkUrl,
  fileName,
  fileSize,
  fileMimeType,
  updatedAt,
  onClick,
}: ResourceCardProps) {
  const icon = type === "file" ? getFileIcon(fileMimeType) : typeIcons[type]

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="resource-card"
      className="flex w-full flex-col rounded-lg border border-border p-4 text-left transition-colors hover:border-muted-foreground/50"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-lg">
          {icon}
        </div>
        <Badge variant="secondary" className={categoryVariants[category]}>
          {categoryLabels[category]}
        </Badge>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {type === "link" && linkUrl}
        {type === "file" && fileName && (
          <>
            {fileName}
            {fileSize != null && ` · ${formatFileSize(fileSize)}`}
          </>
        )}
        {type === "text" && "Text resource"}
      </p>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {typeLabels[type]} · {formatDate(updatedAt)}
      </p>
    </button>
  )
}
