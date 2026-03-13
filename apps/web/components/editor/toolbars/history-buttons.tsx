"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
} from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import { useToolbarEditor } from "../toolbar-provider"

export function UndoButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={false}
      disabled={!editor?.can().undo()}
      onPressedChange={() => editor?.chain().focus().undo().run()}
      aria-label="Undo"
    >
      <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function RedoButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={false}
      disabled={!editor?.can().redo()}
      onPressedChange={() => editor?.chain().focus().redo().run()}
      aria-label="Redo"
    >
      <HugeiconsIcon icon={ArrowTurnForwardIcon} strokeWidth={2} />
    </Toggle>
  )
}
