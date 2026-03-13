"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
} from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import { useToolbarEditor } from "../toolbar-provider"

export function AlignLeftButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive({ textAlign: "left" }) ?? false}
      onPressedChange={() =>
        editor?.chain().focus().setTextAlign("left").run()
      }
      aria-label="Align left"
    >
      <HugeiconsIcon icon={TextAlignLeftIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function AlignCenterButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive({ textAlign: "center" }) ?? false}
      onPressedChange={() =>
        editor?.chain().focus().setTextAlign("center").run()
      }
      aria-label="Align center"
    >
      <HugeiconsIcon icon={TextAlignCenterIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function AlignRightButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive({ textAlign: "right" }) ?? false}
      onPressedChange={() =>
        editor?.chain().focus().setTextAlign("right").run()
      }
      aria-label="Align right"
    >
      <HugeiconsIcon icon={TextAlignRightIcon} strokeWidth={2} />
    </Toggle>
  )
}
