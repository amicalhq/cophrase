"use client"

import { Separator } from "@workspace/ui/components/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { MOCK_VERSIONS } from "../mock-data"

interface EditorToolbarProps {
  selectedVersion: string
  onVersionChange: (version: string) => void
  isChatOpen: boolean
  onChatToggle: () => void
}

export function EditorToolbar({
  selectedVersion,
  onVersionChange,
  isChatOpen,
  onChatToggle,
}: EditorToolbarProps) {
  return (
    <div className="border-border flex h-11 shrink-0 items-center justify-between border-b px-2">
      <div className="flex items-center gap-0.5">
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

      <div className="flex items-center gap-1.5">
        <Select value={selectedVersion} onValueChange={onVersionChange}>
          <SelectTrigger className="w-[10rem] text-xs h-7" size="sm" aria-label="Version">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOCK_VERSIONS.map((version) => (
              <SelectItem key={version.id} value={version.id}>
                {version.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={onChatToggle}
          aria-label="Toggle AI agent"
          aria-pressed={isChatOpen}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-all ${
            isChatOpen
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/25"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <HugeiconsIcon icon={AiMagicIcon} size={16} />
        </button>
      </div>
    </div>
  )
}
