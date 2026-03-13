"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
} from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import { useToolbarEditor } from "../toolbar-provider"

export function BoldButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("bold") ?? false}
      onPressedChange={() => editor?.chain().focus().toggleBold().run()}
      aria-label="Bold"
    >
      <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function ItalicButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("italic") ?? false}
      onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
      aria-label="Italic"
    >
      <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function UnderlineButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("underline") ?? false}
      onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}
      aria-label="Underline"
    >
      <HugeiconsIcon icon={TextUnderlineIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function StrikethroughButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("strike") ?? false}
      onPressedChange={() => editor?.chain().focus().toggleStrike().run()}
      aria-label="Strikethrough"
    >
      <HugeiconsIcon icon={TextStrikethroughIcon} strokeWidth={2} />
    </Toggle>
  )
}
