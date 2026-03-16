"use client"

import { useCallback, useEffect, useState } from "react"
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

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  "research-notes": "Research",
  "blog-draft": "Drafts",
  "humanized-draft": "Humanized",
  "final-blog": "Final",
}

function typeLabel(type: string): string {
  return ARTIFACT_TYPE_LABELS[type] ?? type.replace(/-/g, " ")
}

// ---------------------------------------------------------------------------
// useArtifacts hook — fetches and polls content-scoped artifacts
// ---------------------------------------------------------------------------

export function useArtifacts(contentId: string) {
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([])
  const [grouped, setGrouped] = useState<Record<string, ArtifactData[]>>({})
  const [loading, setLoading] = useState(false)

  const fetchArtifacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/content/${contentId}/artifacts`)
      if (!res.ok) return
      const data = (await res.json()) as {
        artifacts: ArtifactData[]
        grouped: Record<string, ArtifactData[]>
      }
      setArtifacts(data.artifacts)
      setGrouped(data.grouped)
    } catch {
      // silently fail — artifacts are supplementary
    } finally {
      setLoading(false)
    }
  }, [contentId])

  useEffect(() => {
    fetchArtifacts()
    const interval = setInterval(fetchArtifacts, 5000)
    return () => clearInterval(interval)
  }, [fetchArtifacts])

  return { artifacts, grouped, loading }
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

  const types = Object.keys(grouped)

  const handleChange = (value: string) => {
    if (value === "__none__") {
      onSelect(null)
      return
    }
    const artifact = artifacts.find((a) => a.id === value)
    onSelect(artifact ?? null)
  }

  return (
    <Select
      value={selectedId ?? "__none__"}
      onValueChange={handleChange}
    >
      <SelectTrigger
        className="w-[12rem] text-xs h-7"
        size="sm"
        aria-label="Artifact"
        data-testid="artifact-picker"
      >
        <SelectValue placeholder="Select artifact..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-xs">
          No artifact
        </SelectItem>
        {types.map((type) => (
          <SelectGroup key={type}>
            <SelectLabel className="text-[10px] uppercase tracking-wider">
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
