"use client"

import { Badge } from "@workspace/ui/components/badge"

export interface ArtifactData {
  id: string
  type: string
  title: string
  data: unknown
  version: number
  status: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Research notes renderer
// ---------------------------------------------------------------------------

export interface ResearchNotesData {
  keywords?: string[]
  sources?: Array<{ title: string; url?: string }>
  insights?: string[]
  [key: string]: unknown
}

export function ResearchNotesView({ data }: { data: ResearchNotesData }) {
  return (
    <div className="space-y-6">
      {data.keywords && data.keywords.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Keywords</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.map((kw) => (
              <Badge key={kw} variant="secondary">
                {kw}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {data.sources && data.sources.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Sources</h3>
          <ul className="space-y-1 text-sm">
            {data.sources.map((src, i) => (
              <li key={i} className="text-muted-foreground">
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {src.title}
                  </a>
                ) : (
                  src.title
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.insights && data.insights.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Insights</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {data.insights.map((insight, i) => (
              <li key={i} className="text-muted-foreground">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blog draft renderer (markdown-ish display)
// ---------------------------------------------------------------------------

interface BlogDraftData {
  content?: string
  markdown?: string
  [key: string]: unknown
}

function BlogDraftView({ data }: { data: BlogDraftData }) {
  const text = data.content ?? data.markdown ?? ""
  if (!text) {
    return (
      <p className="text-sm text-muted-foreground">No draft content found.</p>
    )
  }

  return (
    <pre className="prose prose-sm max-w-none font-sans text-sm leading-relaxed whitespace-pre-wrap dark:prose-invert">
      {text}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Generic JSON viewer
// ---------------------------------------------------------------------------

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// ArtifactViewer
// ---------------------------------------------------------------------------

interface ArtifactViewerProps {
  artifact: ArtifactData
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const renderContent = () => {
    if (!artifact.data) {
      return (
        <p className="text-sm text-muted-foreground">No artifact data.</p>
      )
    }

    switch (artifact.type) {
      case "research-notes":
        return (
          <ResearchNotesView data={artifact.data as ResearchNotesData} />
        )
      case "blog-draft":
      case "humanized-draft":
        return <BlogDraftView data={artifact.data as BlogDraftData} />
      default:
        return <JsonView data={artifact.data} />
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-medium">{artifact.title}</h2>
        <Badge variant="outline" className="text-xs">
          {artifact.type}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          v{artifact.version}
        </Badge>
      </div>
      {renderContent()}
    </div>
  )
}
