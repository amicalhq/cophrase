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
  markdown?: string
  [key: string]: unknown
}

export function ResearchNotesView({ data }: { data: ResearchNotesData }) {
  if (data.markdown) {
    return (
      <pre className="prose prose-sm max-w-none font-sans text-sm leading-relaxed whitespace-pre-wrap dark:prose-invert">
        {data.markdown}
      </pre>
    )
  }

  // Fallback: render raw JSON for artifacts without markdown field
  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Blog draft renderer (markdown-ish display)
// ---------------------------------------------------------------------------

interface BlogDraftData {
  content?: string
  markdown?: string
  headline?: string
  intro?: string
  body?: Array<string | { heading?: string; content?: string }>
  conclusion?: string
  cta?: string
  metaDescription?: string
  [key: string]: unknown
}

function BlogDraftView({ data }: { data: BlogDraftData }) {
  // Handle flat markdown/content string
  const flat = data.markdown ?? data.content
  if (flat) {
    return (
      <pre className="prose prose-sm max-w-none font-sans text-sm leading-relaxed whitespace-pre-wrap dark:prose-invert">
        {flat}
      </pre>
    )
  }

  // Handle structured format (headline, intro, body sections, conclusion)
  const hasSections = data.headline || data.intro || data.body || data.conclusion
  if (!hasSections) {
    return (
      <p className="text-sm text-muted-foreground">No draft content found.</p>
    )
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {data.headline && <h1>{data.headline}</h1>}
      {data.metaDescription && (
        <p className="text-muted-foreground italic">{data.metaDescription}</p>
      )}
      {data.intro && <p>{data.intro}</p>}
      {data.body?.map((section, i) => {
        if (typeof section === "string") return <p key={i}>{section}</p>
        return (
          <div key={i}>
            {section.heading && <h2>{section.heading}</h2>}
            {section.content && <p>{section.content}</p>}
          </div>
        )
      })}
      {data.conclusion && <p>{data.conclusion}</p>}
      {data.cta && <p className="font-medium">{data.cta}</p>}
    </div>
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
