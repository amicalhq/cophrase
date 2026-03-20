"use client"

import type { ArtifactData } from "./artifact-viewer"

interface ImageViewerProps {
  artifact: ArtifactData | null
}

export function ImageViewer({ artifact }: ImageViewerProps) {
  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No image artifact yet. Use the AI agent to generate an image.
      </div>
    )
  }

  const data = artifact.data as {
    url?: string
    base64?: string
    alt?: string
    caption?: string
    [key: string]: unknown
  }

  const src = data.url ?? (data.base64 ? `data:image/png;base64,${data.base64}` : null)

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={data.alt ?? artifact.title}
            className="max-h-[500px] max-w-full rounded-lg border object-contain"
          />
          {data.caption && (
            <p className="text-sm text-muted-foreground">{data.caption}</p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12">
          <p className="text-sm font-medium">Image artifact</p>
          <p className="text-xs text-muted-foreground">
            {artifact.title} (v{artifact.version})
          </p>
          <pre className="mt-4 max-w-md overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
