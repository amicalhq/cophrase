"use client"

import { useState } from "react"
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
import { MOCK_VERSIONS, DEFAULT_VERSION } from "./mock-data"
import { BoldButton } from "./toolbars/formatting-buttons"
import { ItalicButton } from "./toolbars/formatting-buttons"
import { UnderlineButton } from "./toolbars/formatting-buttons"
import { LinkButton } from "./toolbars/insert-buttons"
import { SlashCommand } from "./extensions/slash-command"

export function EditorPanel() {
  const [selectedVersion, setSelectedVersion] = useState(DEFAULT_VERSION)

  const initialContent =
    MOCK_VERSIONS.find((v) => v.id === DEFAULT_VERSION)?.content ?? ""

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
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none px-8 py-6 outline-none min-h-full",
      },
    },
  })

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version)
    const content = MOCK_VERSIONS.find((v) => v.id === version)?.content ?? ""
    editor?.commands.setContent(content)
  }

  return (
    <ToolbarProvider editor={editor}>
      <div className="flex h-full flex-col">
        <EditorToolbar
          selectedVersion={selectedVersion}
          onVersionChange={handleVersionChange}
        />
        <div className="flex-1 overflow-y-auto">
          {editor && (
            <BubbleMenu
              editor={editor}
              className="bg-background border-border flex items-center gap-0.5 rounded-md border p-1 shadow-md"
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
