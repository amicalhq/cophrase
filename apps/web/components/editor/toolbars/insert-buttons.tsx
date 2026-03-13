"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Link01Icon, Image01Icon } from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import { useToolbarEditor } from "../toolbar-provider"

export function LinkButton() {
  const editor = useToolbarEditor()

  const handlePress = () => {
    if (editor?.isActive("link")) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt("Enter URL")
      if (url) {
        editor?.chain().focus().setLink({ href: url }).run()
      }
    }
  }

  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("link") ?? false}
      onPressedChange={handlePress}
      aria-label="Link"
    >
      <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
    </Toggle>
  )
}

export function ImageButton() {
  const editor = useToolbarEditor()

  const handlePress = () => {
    const url = window.prompt("Enter image URL")
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <Toggle
      size="sm"
      pressed={false}
      onPressedChange={handlePress}
      aria-label="Image"
    >
      <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
    </Toggle>
  )
}
