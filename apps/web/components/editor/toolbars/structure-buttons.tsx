"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Heading04Icon,
  LeftToRightBlockQuoteIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons"
import { Toggle } from "@workspace/ui/components/toggle"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useToolbarEditor } from "../toolbar-provider"

export function HeadingDropdown() {
  const editor = useToolbarEditor()

  const getCurrentValue = () => {
    if (editor?.isActive("heading", { level: 1 })) return "1"
    if (editor?.isActive("heading", { level: 2 })) return "2"
    if (editor?.isActive("heading", { level: 3 })) return "3"
    if (editor?.isActive("heading", { level: 4 })) return "4"
    return "paragraph"
  }

  const handleChange = (value: string) => {
    if (value === "paragraph") {
      editor?.chain().focus().setParagraph().run()
    } else {
      editor
        ?.chain()
        .focus()
        .toggleHeading({ level: parseInt(value) as 1 | 2 | 3 | 4 })
        .run()
    }
  }

  return (
    <Select value={getCurrentValue()} onValueChange={handleChange}>
      <SelectTrigger className="w-[7rem]" size="sm" aria-label="Text style">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="paragraph">Paragraph</SelectItem>
        <SelectItem value="1">
          <HugeiconsIcon icon={Heading01Icon} strokeWidth={2} />
          Heading 1
        </SelectItem>
        <SelectItem value="2">
          <HugeiconsIcon icon={Heading02Icon} strokeWidth={2} />
          Heading 2
        </SelectItem>
        <SelectItem value="3">
          <HugeiconsIcon icon={Heading03Icon} strokeWidth={2} />
          Heading 3
        </SelectItem>
        <SelectItem value="4">
          <HugeiconsIcon icon={Heading04Icon} strokeWidth={2} />
          Heading 4
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function BlockquoteButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("blockquote") ?? false}
      onPressedChange={() =>
        editor?.chain().focus().toggleBlockquote().run()
      }
      aria-label="Blockquote"
    >
      <HugeiconsIcon icon={LeftToRightBlockQuoteIcon} strokeWidth={2} />
    </Toggle>
  )
}

export function CodeBlockButton() {
  const editor = useToolbarEditor()
  return (
    <Toggle
      size="sm"
      pressed={editor?.isActive("codeBlock") ?? false}
      onPressedChange={() =>
        editor?.chain().focus().toggleCodeBlock().run()
      }
      aria-label="Code block"
    >
      <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />
    </Toggle>
  )
}
