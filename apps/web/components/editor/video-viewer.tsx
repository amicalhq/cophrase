"use client"

import type { ArtifactData } from "./artifact-viewer"

interface VideoViewerProps {
  artifact: ArtifactData | null
}

export function VideoViewer({ artifact }: VideoViewerProps) {
  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No video artifact yet. Use the AI agent to generate a video.
      </div>
    )
  }

  const data = artifact.data as {
    url?: string
    description?: string
    [key: string]: unknown
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
      {data.url ? (
        <video
          src={data.url}
          controls
          className="max-h-[500px] max-w-full rounded-lg border"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12">
          <p className="text-sm font-medium">Video artifact</p>
          <p className="text-xs text-muted-foreground">
            {artifact.title} (v{artifact.version})
          </p>
          {data.description && (
            <p className="mt-2 text-sm text-muted-foreground">{data.description}</p>
          )}
          <pre className="mt-4 max-w-md overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
