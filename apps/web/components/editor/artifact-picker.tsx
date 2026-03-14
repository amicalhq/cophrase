"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  Search01Icon,
  TextIcon,
  AiBeautifyIcon,
  File01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import type { ArtifactData } from "./artifact-viewer"

interface ArtifactPickerProps {
  runId: string
  selectedId: string | null
  onSelect: (artifact: ArtifactData | null) => void
}

const ARTIFACT_ICONS: Record<string, IconSvgElement> = {
  "research-notes": Search01Icon,
  "blog-draft": TextIcon,
  "humanized-draft": AiBeautifyIcon,
}

function getArtifactIcon(type: string): IconSvgElement {
  return ARTIFACT_ICONS[type] ?? File01Icon
}

export function ArtifactPicker({
  runId,
  selectedId,
  onSelect,
}: ArtifactPickerProps) {
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([])
  const [loading, setLoading] = useState(false)

  const fetchArtifacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/runs/${runId}/artifacts`)
      if (!res.ok) return
      const data = (await res.json()) as { artifacts: ArtifactData[] }
      setArtifacts(data.artifacts)
    } catch {
      // silently fail — artifacts are supplementary
    } finally {
      setLoading(false)
    }
  }, [runId])

  // Fetch artifacts when runId changes, and poll while there are fewer than expected
  useEffect(() => {
    fetchArtifacts()
    const interval = setInterval(fetchArtifacts, 5000)
    return () => clearInterval(interval)
  }, [fetchArtifacts])

  if (artifacts.length === 0 && !loading) return null

  return (
    <div className="border-border flex items-center gap-1 border-b px-2 py-1.5">
      <span className="text-muted-foreground mr-1 text-xs font-medium">
        Artifacts
      </span>
      {loading && artifacts.length === 0 && (
        <span className="text-muted-foreground animate-pulse text-xs">
          Loading...
        </span>
      )}
      {artifacts.map((artifact) => (
        <Button
          key={artifact.id}
          variant={selectedId === artifact.id ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-7 gap-1.5 text-xs",
            selectedId === artifact.id && "ring-ring ring-1",
          )}
          onClick={() =>
            onSelect(selectedId === artifact.id ? null : artifact)
          }
        >
          <HugeiconsIcon icon={getArtifactIcon(artifact.type)} size={14} />
          <span className="max-w-[120px] truncate">{artifact.title}</span>
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            v{artifact.version}
          </Badge>
        </Button>
      ))}
    </div>
  )
}
