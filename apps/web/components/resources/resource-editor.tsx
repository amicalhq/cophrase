"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import { Markdown } from "tiptap-markdown"
import type { JSONContent } from "@tiptap/react"
import { Separator } from "@workspace/ui/components/separator"
import { ToolbarProvider } from "@/components/editor/toolbar-provider"
import {
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikethroughButton,
} from "@/components/editor/toolbars/formatting-buttons"
import {
  HeadingDropdown,
  BlockquoteButton,
  CodeBlockButton,
} from "@/components/editor/toolbars/structure-buttons"
import {
  BulletListButton,
  OrderedListButton,
  HorizontalRuleButton,
} from "@/components/editor/toolbars/list-buttons"
import { LinkButton } from "@/components/editor/toolbars/insert-buttons"
import {
  UndoButton,
  RedoButton,
} from "@/components/editor/toolbars/history-buttons"

interface ResourceEditorProps {
  content?: JSONContent | null
  onChange: (content: JSONContent) => void
}

export function ResourceEditor({ content, onChange }: ResourceEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write your resource content here...",
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
      Markdown,
    ],
    content: content ?? undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[500px] focus:outline-none px-4 py-3",
      },
    },
  })

  return (
    <ToolbarProvider editor={editor}>
      <div className="rounded-md border border-input">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
          <UndoButton />
          <RedoButton />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <HeadingDropdown />
          <BlockquoteButton />
          <CodeBlockButton />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <BoldButton />
          <ItalicButton />
          <UnderlineButton />
          <StrikethroughButton />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <BulletListButton />
          <OrderedListButton />
          <HorizontalRuleButton />

          <Separator orientation="vertical" className="mx-1 h-5" />

          <LinkButton />
        </div>

        {/* Bubble menu for inline formatting */}
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

        <EditorContent editor={editor} />
      </div>
    </ToolbarProvider>
  )
}
