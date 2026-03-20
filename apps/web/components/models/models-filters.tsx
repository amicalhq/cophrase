"use client"

import { Input } from "@workspace/ui/components/input"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

interface ModelsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  typeFilter: string
  onTypeFilterChange: (value: string) => void
}

const MODEL_TYPES = [
  { value: "all", label: "All" },
  { value: "language", label: "Language" },
  { value: "embedding", label: "Embedding" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
]

export function ModelsFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: ModelsFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <Input
        className="max-w-xs"
        placeholder="Search models..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <ToggleGroup
        type="single"
        variant="outline"
        value={typeFilter}
        onValueChange={(val) => {
          if (val) onTypeFilterChange(val)
        }}
      >
        {MODEL_TYPES.map((t) => (
          <ToggleGroupItem key={t.value} value={t.value}>
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
