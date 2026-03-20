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
import { FrontmatterForm } from "./frontmatter-form"

interface EditorPanelProps {
  isChatOpen: boolean
  onChatToggle: () => void
  artifact: ArtifactData | null
  artifacts: ArtifactData[]
  groupedArtifacts: Record<string, ArtifactData[]>
  onArtifactSelect: (artifact: ArtifactData | null) => void
  contentId: string
  contentFormat: string
}

const TEXT_ARTIFACT_TYPES = new Set([
  "blog-draft",
  "humanized-draft",
  "final-blog",
])

export function EditorPanel({
  isChatOpen,
  onChatToggle,
  artifact,
  artifacts,
  groupedArtifacts,
  onArtifactSelect,
  contentId,
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
      const data = artifact.data as { markdown?: string; content?: string }
      const content = data.markdown ?? data.content ?? ""
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
        <FrontmatterForm contentId={contentId} />
        <div className="flex-1 overflow-y-auto p-6">
          <ResearchNotesView
            data={
              artifact.data as import("./artifact-viewer").ResearchNotesData
            }
          />
        </div>
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
        <FrontmatterForm contentId={contentId} />
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
