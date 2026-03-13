"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion"
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
import type { Editor } from "@tiptap/core"
import type { IconSvgElement } from "@hugeicons/react"
import type { Instance as TippyInstance } from "tippy.js"
import tippy from "tippy.js"

interface CommandItem {
  label: string
  icon: IconSvgElement
  command: (editor: Editor) => void
}

const allItems: CommandItem[] = [
  {
    label: "Heading 1",
    icon: Heading01Icon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    icon: Heading02Icon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: Heading03Icon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bullet List",
    icon: LeftToRightListBulletIcon,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Ordered List",
    icon: LeftToRightListNumberIcon,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Blockquote",
    icon: LeftToRightBlockQuoteIcon,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "Code Block",
    icon: SourceCodeIcon,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Horizontal Rule",
    icon: MinusSignIcon,
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    label: "Image",
    icon: Image01Icon,
    command: (editor) => {
      const url = window.prompt("Enter image URL")
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    },
  },
]

interface CommandListProps {
  items: CommandItem[]
  command: (item: CommandItem) => void
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  function CommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex]
          if (item) {
            command(item)
          }
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return null
    }

    return (
      <div
        ref={containerRef}
        className="bg-background border-border z-50 max-h-72 overflow-y-auto rounded-md border shadow-md"
      >
        <div className="flex flex-col py-1">
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent"
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault()
                command(item)
              }}
            >
              <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    )
  },
)

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowedPrefixes: null,
        startOfLine: false,
        command({ editor, range, props }) {
          const item = props as CommandItem
          // Delete the "/" (and any query text) then run the command
          editor.chain().focus().deleteRange(range).run()
          item.command(editor)
        },
        items({ query }) {
          if (!query) return allItems
          const lowerQuery = query.toLowerCase()
          return allItems.filter((item) =>
            item.label.toLowerCase().includes(lowerQuery),
          )
        },
        render() {
          let reactRenderer: ReactRenderer<CommandListRef, CommandListProps>
          let popup: TippyInstance[]

          return {
            onStart(props: SuggestionProps<CommandItem>) {
              reactRenderer = new ReactRenderer(CommandList, {
                props: {
                  items: props.items,
                  command: props.command,
                },
                editor: props.editor,
              })

              if (!props.clientRect) return

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: reactRenderer.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              })
            },

            onUpdate(props: SuggestionProps<CommandItem>) {
              reactRenderer.updateProps({
                items: props.items,
                command: props.command,
              })

              if (!props.clientRect) return

              popup[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              })
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                popup[0]?.hide()
                return true
              }
              return reactRenderer.ref?.onKeyDown(props) ?? false
            },

            onExit() {
              popup[0]?.destroy()
              reactRenderer.destroy()
            },
          }
        },
      }),
    ]
  },
})
