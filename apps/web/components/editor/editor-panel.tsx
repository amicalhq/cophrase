"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import Image from "@tiptap/extension-image"
import { Markdown } from "tiptap-markdown"
import { ToolbarProvider } from "./toolbar-provider"
import { EditorToolbar } from "./toolbars/editor-toolbar"
import type { ArtifactData } from "./artifact-viewer"
import { ResearchNotesView } from "./artifact-viewer"
import { ArtifactSelect } from "./artifact-picker"
import { BoldButton } from "./toolbars/formatting-buttons"
import { ItalicButton } from "./toolbars/formatting-buttons"
import { UnderlineButton } from "./toolbars/formatting-buttons"
import { LinkButton } from "./toolbars/insert-buttons"
import { SlashCommand } from "./extensions/slash-command"
import { PlainTextEditor } from "./plain-text-editor"
import { ImageViewer } from "./image-viewer"
import { VideoViewer } from "./video-viewer"
import { DeckViewer } from "./deck-viewer"

interface EditorPanelProps {
  isChatOpen: boolean
  onChatToggle: () => void
  artifact: ArtifactData | null
  artifacts: ArtifactData[]
  groupedArtifacts: Record<string, ArtifactData[]>
  onArtifactSelect: (artifact: ArtifactData | null) => void
  contentFormat: string
}

const TEXT_ARTIFACT_TYPES = new Set([
  "blog-draft",
  "humanized-draft",
  "final-blog",
])

/**
 * Extract displayable markdown from artifact data.
 * Handles both flat { markdown } and structured { headline, intro, body, conclusion } formats.
 */
function extractMarkdown(data: unknown): string {
  if (!data) return ""
  if (typeof data === "string") return data
  if (typeof data !== "object") return ""
  const d = data as Record<string, unknown>

  // Flat format: single markdown or content string
  if (typeof d.markdown === "string") return d.markdown
  if (typeof d.content === "string") return d.content

  // Structured format: assemble fields into markdown
  // Handles both schemas: { intro, body } and { introduction, sections }
  const parts: string[] = []
  if (typeof d.headline === "string") parts.push(`# ${d.headline}`)
  if (typeof d.metaDescription === "string")
    parts.push(`*${d.metaDescription}*`)
  const intro = d.intro ?? d.introduction
  if (typeof intro === "string") parts.push(intro)
  const body = d.body ?? d.sections
  if (Array.isArray(body)) {
    for (const section of body) {
      if (typeof section === "string") {
        parts.push(section)
      } else if (section && typeof section === "object") {
        const s = section as Record<string, unknown>
        if (typeof s.heading === "string") parts.push(`## ${s.heading}`)
        if (typeof s.content === "string") parts.push(s.content)
      }
    }
  }
  if (typeof d.conclusion === "string") parts.push(d.conclusion)
  if (typeof d.cta === "string") parts.push(d.cta)

  return parts.length > 0 ? parts.join("\n\n") : ""
}

export function EditorPanel({
  isChatOpen,
  onChatToggle,
  artifact,
  artifacts,
  groupedArtifacts,
  onArtifactSelect,
  contentFormat,
}: EditorPanelProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing or ask the AI agent...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Link.configure({
        openOnClick: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      Image,
      Markdown,
      SlashCommand,
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none px-8 py-6 outline-none min-h-full",
      },
    },
  })

  // Sync text artifact content into Tiptap when artifact changes
  useEffect(() => {
    if (!editor) return
    if (artifact && TEXT_ARTIFACT_TYPES.has(artifact.type)) {
      const content = extractMarkdown(artifact.data)
      editor.commands.setContent(content)
    } else if (!artifact) {
      editor.commands.setContent("")
    }
  }, [editor, artifact])

  const artifactSelect = (
    <ArtifactSelect
      artifacts={artifacts}
      grouped={groupedArtifacts}
      selectedId={artifact?.id ?? null}
      onSelect={onArtifactSelect}
    />
  )

  // When artifact is research-notes type, render the structured view instead of Tiptap
  if (artifact && artifact.type === "research-notes") {
    return (
      <div className="flex h-full flex-col">
        <EditorToolbar
          isChatOpen={isChatOpen}
          onChatToggle={onChatToggle}
          trailing={artifactSelect}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <ResearchNotesView data={artifact.data} />
        </div>
      </div>
    )
  }

  // Format-specific rendering for non-rich-text formats
  if (contentFormat !== "rich_text") {
    return (
      <div className="flex h-full flex-col">
        <EditorToolbar
          isChatOpen={isChatOpen}
          onChatToggle={onChatToggle}
          trailing={artifactSelect}
        />
        {contentFormat === "plain_text" && (
          <PlainTextEditor artifact={artifact} />
        )}
        {contentFormat === "image" && <ImageViewer artifact={artifact} />}
        {contentFormat === "video" && <VideoViewer artifact={artifact} />}
        {contentFormat === "deck" && <DeckViewer artifact={artifact} />}
      </div>
    )
  }

  return (
    <ToolbarProvider editor={editor}>
      <div className="flex h-full flex-col">
        <EditorToolbar
          isChatOpen={isChatOpen}
          onChatToggle={onChatToggle}
          trailing={artifactSelect}
        />
        <div className="flex-1 overflow-y-auto">
          {editor && (
            <BubbleMenu
              editor={editor}
              className="flex items-center gap-0.5 rounded-md border border-border bg-background p-1 shadow-md"
            >
              <BoldButton />
              <ItalicButton />
              <UnderlineButton />
              <LinkButton />
            </BubbleMenu>
          )}
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </ToolbarProvider>
  )
}
