"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import type { JSONContent } from "@tiptap/react"

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
    ],
    content: content ?? undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] focus:outline-none p-3",
      },
    },
  })

  return (
    <div className="rounded-md border border-input">
      <EditorContent editor={editor} />
    </div>
  )
}
