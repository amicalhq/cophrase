"use client"

import type { Editor } from "@tiptap/react"
import { FloatingMenu } from "@tiptap/react/menus"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  LeftToRightBlockQuoteIcon,
  SourceCodeIcon,
  MinusSignIcon,
  Image01Icon,
} from "@hugeicons/core-free-icons"

interface SlashMenuProps {
  editor: Editor
}

const menuItems = [
  {
    label: "Heading 1",
    icon: Heading01Icon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: Heading02Icon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: Heading03Icon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bullet List",
    icon: LeftToRightListBulletIcon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Ordered List",
    icon: LeftToRightListNumberIcon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Blockquote",
    icon: LeftToRightBlockQuoteIcon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "Code Block",
    icon: SourceCodeIcon,
    command: (editor: Editor) =>
      editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Horizontal Rule",
    icon: MinusSignIcon,
    command: (editor: Editor) =>
      editor.chain().focus().setHorizontalRule().run(),
  },
  {
    label: "Image",
    icon: Image01Icon,
    command: (editor: Editor) => {
      const url = window.prompt("Enter image URL")
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    },
  },
]

export function SlashMenu({ editor }: SlashMenuProps) {
  return (
    <FloatingMenu
      editor={editor}
      shouldShow={({ state }) => {
        const { $from } = state.selection
        const currentLineText = $from.nodeBefore?.textContent ?? ""
        return currentLineText === "/"
      }}
      className="bg-background border-border z-50 overflow-hidden rounded-md border shadow-md"
    >
      <div className="flex flex-col py-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
            onMouseDown={(e) => {
              e.preventDefault()
              // Delete the slash character before running the command
              editor.chain().focus().deleteRange({
                from: editor.state.selection.$from.pos - 1,
                to: editor.state.selection.$from.pos,
              }).run()
              item.command(editor)
            }}
          >
            <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </div>
    </FloatingMenu>
  )
}
