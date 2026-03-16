"use client"

import { Separator } from "@workspace/ui/components/separator"
import { UndoButton, RedoButton } from "./history-buttons"
import {
  HeadingDropdown,
  BlockquoteButton,
  CodeBlockButton,
} from "./structure-buttons"
import {
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikethroughButton,
} from "./formatting-buttons"
import {
  BulletListButton,
  OrderedListButton,
  HorizontalRuleButton,
} from "./list-buttons"
import { LinkButton, ImageButton } from "./insert-buttons"
import {
  AlignLeftButton,
  AlignCenterButton,
  AlignRightButton,
} from "./align-buttons"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutAlignLeftIcon } from "@hugeicons/core-free-icons"

interface EditorToolbarProps {
  isChatOpen: boolean
  onChatToggle: () => void
}

export function EditorToolbar({
  isChatOpen,
  onChatToggle,
}: EditorToolbarProps) {
  return (
    <div className="border-border flex h-11 shrink-0 items-center justify-between border-b px-2">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onChatToggle}
          aria-label="Toggle sidebar"
          aria-pressed={isChatOpen}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            isChatOpen
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <HugeiconsIcon icon={LayoutAlignLeftIcon} size={16} />
        </button>

        <Separator orientation="vertical" className="mx-1 h-5" />

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
        <ImageButton />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <AlignLeftButton />
        <AlignCenterButton />
        <AlignRightButton />
      </div>
    </div>
  )
}
