"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AbstractChat,
  DefaultChatTransport,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from "ai"
import { ArrowLeft01Icon, SentIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"

// ---------------------------------------------------------------------------
// Minimal React-aware Chat subclass
// ---------------------------------------------------------------------------

type SimpleMessage = UIMessage

class ReactChat extends AbstractChat<SimpleMessage> {
  private notify: () => void

  constructor(api: string, notify: () => void) {
    // Build a mutable ChatState backed by plain arrays/values.
    // `snapshot` is called by AbstractChat to capture immutable snapshots —
    // returning the value as-is is fine for simple use-cases.
    const state: ChatState<SimpleMessage> = {
      status: "ready" as ChatStatus,
      error: undefined,
      messages: [] as SimpleMessage[],
      pushMessage(message: SimpleMessage) {
        this.messages = [...this.messages, message]
      },
      popMessage() {
        this.messages = this.messages.slice(0, -1)
      },
      replaceMessage(index: number, message: SimpleMessage) {
        const next = [...this.messages]
        next[index] = message
        this.messages = next
      },
      snapshot<T>(thing: T): T {
        return thing
      },
    }

    super({
      transport: new DefaultChatTransport({ api }),
      state,
    })

    this.notify = notify
  }

  // Override setStatus so React re-renders when status/messages change.
  protected override setStatus(args: { status: ChatStatus; error?: Error }) {
    super.setStatus(args)
    this.notify()
  }
}

// ---------------------------------------------------------------------------
// useChat hook
// ---------------------------------------------------------------------------

function useChat({ api }: { api: string }) {
  const [, forceUpdate] = useState(0)
  const notify = useCallback(() => forceUpdate((n) => n + 1), [])

  // Keep a stable ReactChat instance across renders.
  const chatRef = useRef<ReactChat | null>(null)
  if (chatRef.current === null) {
    chatRef.current = new ReactChat(api, notify)
  }
  const chat = chatRef.current

  // Re-render whenever messages array reference changes (set by AbstractChat).
  // We also subscribe to each sendMessage call via the notify callback above.
  const messages = chat.messages
  const status = chat.status
  const isLoading = status === "submitted" || status === "streaming"

  const [input, setInput] = useState("")

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value)
    },
    [],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return
      setInput("")
      chat.sendMessage({ text }).then(() => notify())
    },
    [input, isLoading, chat, notify],
  )

  // Trigger re-renders when messages change (AbstractChat mutates state.messages).
  useEffect(() => {
    // poll-free: we rely on notify() calls from setStatus + sendMessage chain.
    // This effect is intentionally empty — just ensuring the component re-renders
    // by having messages in the dependency list.
  }, [messages])

  return { messages, input, handleInputChange, handleSubmit, isLoading }
}

// ---------------------------------------------------------------------------
// Helper: extract text from a UIMessage
// ---------------------------------------------------------------------------

function getMessageText(message: SimpleMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? String(p.text) : ""))
    .join("")
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  onCollapse: () => void
}

export function ChatPanel({ onCollapse }: ChatPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: "/api/chat" })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">AI Agent</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCollapse}
          aria-label="Collapse chat"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </Button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ask the AI agent to help you write, edit, or improve your content.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {getMessageText(message)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted animate-pulse rounded-lg px-3 py-2 text-sm">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask the AI agent..."
            disabled={isLoading}
            className="border-input bg-background placeholder:text-muted-foreground flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-offset-0 disabled:opacity-50"
          />
          <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
            <HugeiconsIcon icon={SentIcon} size={14} />
            Send
          </Button>
        </form>
        <p className="text-muted-foreground mt-1.5 text-xs">Mock LLM</p>
      </div>
    </div>
  )
}
