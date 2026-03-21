"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { ArtifactData } from "./artifact-viewer"
import { trpc } from "@/lib/trpc/client"

const ARTIFACT_TYPE_ORDER: string[] = [
  "research-notes",
  "blog-draft",
  "humanized-draft",
  "final-blog",
]

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  "research-notes": "Research",
  "blog-draft": "Drafts",
  "humanized-draft": "Humanized",
  "final-blog": "Final",
}

export function typeLabel(type: string): string {
  return ARTIFACT_TYPE_LABELS[type] ?? type.replace(/-/g, " ")
}

/** Sort type keys by stage order (unknown types go last). */
export function sortedTypeKeys(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = ARTIFACT_TYPE_ORDER.indexOf(a)
    const bi = ARTIFACT_TYPE_ORDER.indexOf(b)
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
  })
}

// ---------------------------------------------------------------------------
// useArtifacts hook — fetches and polls content-scoped artifacts
// ---------------------------------------------------------------------------

export function useArtifacts(contentId: string) {
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([])
  const [grouped, setGrouped] = useState<Record<string, ArtifactData[]>>({})

  const { data, isLoading } = trpc.content.artifacts.useQuery(
    { contentId },
    { refetchInterval: 5000 },
  )

  useEffect(() => {
    if (data) {
      setArtifacts(data.artifacts as ArtifactData[])
      setGrouped(data.grouped as Record<string, ArtifactData[]>)
    }
  }, [data])

  return { artifacts, grouped, loading: isLoading }
}

// ---------------------------------------------------------------------------
// ArtifactSelect — dropdown that replaces the old version picker
// ---------------------------------------------------------------------------

interface ArtifactSelectProps {
  artifacts: ArtifactData[]
  grouped: Record<string, ArtifactData[]>
  selectedId: string | null
  onSelect: (artifact: ArtifactData | null) => void
}

export function ArtifactSelect({
  artifacts,
  grouped,
  selectedId,
  onSelect,
}: ArtifactSelectProps) {
  if (artifacts.length === 0) return null

  const types = sortedTypeKeys(Object.keys(grouped))

  const handleChange = (value: string) => {
    if (value === "__none__") {
      onSelect(null)
      return
    }
    const artifact = artifacts.find((a) => a.id === value)
    onSelect(artifact ?? null)
  }

  return (
    <Select value={selectedId ?? "__none__"} onValueChange={handleChange}>
      <SelectTrigger
        className="h-7 w-[12rem] text-xs"
        size="sm"
        aria-label="Artifact"
        data-testid="artifact-picker"
      >
        <SelectValue placeholder="Pick artifact to display" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-xs">
          Pick artifact to display
        </SelectItem>
        {types.map((type) => (
          <SelectGroup key={type}>
            <SelectLabel className="text-[10px] tracking-wider uppercase">
              {typeLabel(type)}
            </SelectLabel>
            {grouped[type]!.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                {a.title} — v{a.version}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
