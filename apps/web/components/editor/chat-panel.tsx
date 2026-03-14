"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { Badge } from "@workspace/ui/components/badge"
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
  private onRunIdCapture?: (runId: string) => void

  constructor(
    api: string,
    body: Record<string, unknown>,
    notify: () => void,
    onRunIdCapture?: (runId: string) => void,
  ) {
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

    // Use a custom fetch to intercept the response and extract x-run-id
    const captureRunId = onRunIdCapture
    const customFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init)
      const runId = response.headers.get("x-run-id")
      if (runId && captureRunId) {
        captureRunId(runId)
      }
      return response
    }

    super({
      transport: new DefaultChatTransport({
        api,
        body,
        fetch: customFetch,
      }),
      state,
    })

    this.notify = notify
    this.onRunIdCapture = onRunIdCapture
  }

  protected override setStatus(args: { status: ChatStatus; error?: Error }) {
    super.setStatus(args)
    this.notify()
  }
}

// ---------------------------------------------------------------------------
// useAgentChat hook
// ---------------------------------------------------------------------------

function useAgentChat({
  api,
  body,
  onRunId,
}: {
  api: string
  body: Record<string, unknown>
  onRunId?: (runId: string) => void
}) {
  const [, forceUpdate] = useState(0)
  const notify = useCallback(() => forceUpdate((n) => n + 1), [])

  const chatRef = useRef<ReactChat | null>(null)
  if (chatRef.current === null) {
    chatRef.current = new ReactChat(api, body, notify, onRunId)
  }
  const chat = chatRef.current

  const messages = chat.messages
  const status = chat.status
  const isLoading = status === "submitted" || status === "streaming"

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return
      chat.sendMessage({ text }).then(() => notify()).catch((err) => { console.error("sendMessage error:", err); notify() })
    },
    [isLoading, chat, notify],
  )

  return { messages, status, isLoading, sendMessage }
}

// ---------------------------------------------------------------------------
// Helpers
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
    .map((p, i) => ({
      id: `${message.id}-text-${i}`,
      text: String((p as { text: string }).text),
    }))
}

// ---------------------------------------------------------------------------
// Status label for the agent run
// ---------------------------------------------------------------------------

function statusLabel(status: ChatStatus): string | null {
  switch (status) {
    case "submitted":
      return "Starting agent..."
    case "streaming":
      return "Agent is working..."
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  orgId: string
  projectId: string
  contentId: string
  onRunId?: (runId: string) => void
}

export function ChatPanel({
  orgId,
  projectId,
  contentId,
  onRunId,
}: ChatPanelProps) {
  const router = useRouter()

  const { messages, status, isLoading, sendMessage } = useAgentChat({
    api: "/api/agents/runs",
    body: {
      agentId: "builtin:blog-orchestrator",
      organizationId: orgId,
      projectId,
      contentId,
    },
    onRunId,
  })

  const handlePromptSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  const runStatusText = statusLabel(status)

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
        {runStatusText && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {runStatusText}
          </Badge>
        )}
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

      {status === "error" && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Failed to get a response. Please try again.
        </div>
      )}

      {/* Prompt input */}
      <div className="border-t p-3">
        <PromptInput onSubmit={handlePromptSubmit}>
          <PromptInputTextarea placeholder="Ask the AI agent..." />
          <PromptInputFooter>
            <span className="text-muted-foreground text-xs">
              Blog Orchestrator
            </span>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
