"use client"

import { useCallback, useRef, useState } from "react"
import {
  AbstractChat,
  DefaultChatTransport,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from "ai"
import { useRouter } from "next/navigation"
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"

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

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return
      chat.sendMessage({ text }).then(() => notify())
    },
    [isLoading, chat, notify],
  )

  return { messages, status, isLoading, sendMessage }
}

// ---------------------------------------------------------------------------
// Helper: extract text parts from a UIMessage
// ---------------------------------------------------------------------------

function getReasoningText(message: SimpleMessage): string | null {
  const reasoningPart = message.parts.find((p) => p.type === "reasoning")
  if (!reasoningPart || !("reasoning" in reasoningPart)) return null
  return String(reasoningPart.reasoning)
}

function getTextParts(
  message: SimpleMessage,
): Array<{ id: string; text: string }> {
  return message.parts
    .filter((p) => p.type === "text" && "text" in p)
    .map((p, i) => ({ id: `${message.id}-text-${i}`, text: String((p as { text: string }).text) }))
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const router = useRouter()
  const { messages, status, isLoading, sendMessage } = useChat({
    api: "/api/chat",
  })

  const handlePromptSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border flex h-11 items-center gap-1 border-b px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
        </Button>
        <span className="text-sm font-medium">AI Agent</span>
      </div>

      {/* Messages area */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask the AI agent"
              description="Ask the AI agent to help you write, edit, or improve your content."
            />
          ) : (
            messages.map((message) => {
              const textParts = getTextParts(message)
              const reasoningText = getReasoningText(message)
              const isStreaming =
                status === "streaming" &&
                message === messages[messages.length - 1]

              return (
                <Message key={message.id} from={message.role}>
                  {message.role === "assistant" && reasoningText && (
                    <Reasoning isStreaming={isStreaming}>
                      <ReasoningTrigger />
                      <ReasoningContent>{reasoningText}</ReasoningContent>
                    </Reasoning>
                  )}
                  <MessageContent>
                    {message.role === "assistant" ? (
                      textParts.map(({ id, text }) => (
                        <MessageResponse key={id} isAnimating={isStreaming}>
                          {text}
                        </MessageResponse>
                      ))
                    ) : (
                      textParts.map(({ id, text }) => (
                        <span key={id}>{text}</span>
                      ))
                    )}
                  </MessageContent>
                </Message>
              )
            })
          )}

          {isLoading && messages.length === 0 && (
            <Message from="assistant">
              <MessageContent>
                <span className="text-muted-foreground animate-pulse text-sm">
                  Thinking...
                </span>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt input */}
      <div className="border-t p-3">
        <PromptInput onSubmit={handlePromptSubmit}>
          <PromptInputTextarea placeholder="Ask the AI agent..." />
          <PromptInputFooter>
            <span className="text-muted-foreground text-xs">Mock LLM</span>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
