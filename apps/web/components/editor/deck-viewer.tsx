"use client"

import type { ArtifactData } from "./artifact-viewer"

interface Slide {
  title?: string
  content?: string
  notes?: string
  [key: string]: unknown
}

interface DeckViewerProps {
  artifact: ArtifactData | null
}

export function DeckViewer({ artifact }: DeckViewerProps) {
  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No deck artifact yet. Use the AI agent to generate slides.
      </div>
    )
  }

  const data = artifact.data as {
    slides?: Slide[]
    title?: string
    [key: string]: unknown
  }

  const slides = data.slides ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      {data.title && (
        <h2 className="text-lg font-semibold">{data.title}</h2>
      )}
      {slides.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12">
          <p className="text-sm font-medium">Deck artifact</p>
          <p className="text-xs text-muted-foreground">
            {artifact.title} (v{artifact.version})
          </p>
          <pre className="mt-4 max-w-md overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {slides.map((slide, i) => (
            <li key={i} className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                {slide.title && (
                  <span className="text-sm font-medium">{slide.title}</span>
                )}
              </div>
              {slide.content && (
                <p className="ml-8 text-sm text-muted-foreground">{slide.content}</p>
              )}
              {slide.notes && (
                <p className="ml-8 mt-1 text-xs italic text-muted-foreground">
                  Notes: {slide.notes}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
