"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import { useToolbarEditor } from "../toolbar-provider"

export function BulletListButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("bulletList") ?? false}
      onPressedChange={() =>
        editor?.chain().focus().toggleBulletList().run()
      }
      aria-label="Bullet list"
    >
      <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function OrderedListButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("orderedList") ?? false}
      onPressedChange={() =>
        editor?.chain().focus().toggleOrderedList().run()
      }
      aria-label="Ordered list"
    >
      <HugeiconsIcon icon={LeftToRightListNumberIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function HorizontalRuleButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={false}
      onPressedChange={() =>
        editor?.chain().focus().setHorizontalRule().run()
      }
      aria-label="Horizontal rule"
    >
      <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
    </Toggle>
  )
}
