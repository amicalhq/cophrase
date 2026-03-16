"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
// Types
// ---------------------------------------------------------------------------

type ChatStatus = "ready" | "streaming" | "error"

interface HarnessMessage {
  id: string
  role: "user" | "assistant" | "system"
  parts: unknown
  createdAt: string
}

// ---------------------------------------------------------------------------
// useHarnessChat hook
// ---------------------------------------------------------------------------

function useHarnessChat(contentId: string) {
  const [messages, setMessages] = useState<HarnessMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<string | undefined>(undefined)

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(
          `/api/content/${contentId}/messages?limit=20`,
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          messages: HarnessMessage[]
          nextCursor?: string
        }
        setMessages(data.messages)
        cursorRef.current = data.nextCursor ?? undefined
        setHasMore(!!data.nextCursor)
      } catch {
        // silently fail on initial load
      }
    }
    loadMessages()
  }, [contentId])

  // Load more (older) messages
  const loadMore = useCallback(async () => {
    if (!cursorRef.current || !hasMore) return
    try {
      const res = await fetch(
        `/api/content/${contentId}/messages?cursor=${cursorRef.current}&limit=20`,
      )
      if (!res.ok) return
      const data = (await res.json()) as {
        messages: HarnessMessage[]
        nextCursor?: string
      }
      setMessages((prev) => [...data.messages, ...prev])
      cursorRef.current = data.nextCursor ?? undefined
      setHasMore(!!data.nextCursor)
    } catch {
      // silently fail
    }
  }, [contentId, hasMore])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || status === "streaming") return

      // Optimistically add user message
      const userMsg: HarnessMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        parts: text,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setStatus("streaming")

      try {
        const res = await fetch(`/api/content/${contentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        })

        const runId = res.headers.get("x-workflow-run-id")
        if (runId) setWorkflowRunId(runId)

        if (!res.ok) {
          setStatus("error")
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setStatus("error")
          return
        }

        const decoder = new TextDecoder()
        let assistantText = ""
        const assistantMsgId = `assistant-${Date.now()}`

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          assistantText += chunk

          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantMsgId)
            if (existing) {
              return prev.map((m) =>
                m.id === assistantMsgId ? { ...m, parts: assistantText } : m,
              )
            }
            return [
              ...prev,
              {
                id: assistantMsgId,
                role: "assistant" as const,
                parts: assistantText,
                createdAt: new Date().toISOString(),
              },
            ]
          })
        }

        setStatus("ready")
      } catch {
        setStatus("error")
      }
    },
    [contentId, status],
  )

  // Cancel
  const cancel = useCallback(async () => {
    if (!workflowRunId) return
    try {
      await fetch(`/api/content/${contentId}/chat/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowRunId }),
      })
      setStatus("ready")
    } catch {
      // silently fail
    }
  }, [contentId, workflowRunId])

  return { messages, status, hasMore, sendMessage, loadMore, cancel }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMessageText(message: HarnessMessage): string {
  if (typeof message.parts === "string") return message.parts
  // Handle AI SDK UIMessage parts array
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter(
        (p): p is { type: string; text: string } =>
          typeof p === "object" &&
          p !== null &&
          "type" in p &&
          (p as { type: string }).type === "text" &&
          "text" in p,
      )
      .map((p) => p.text)
      .join("")
  }
  return ""
}

function getReasoningText(message: HarnessMessage): string | null {
  if (!Array.isArray(message.parts)) return null
  const reasoningPart = message.parts.find(
    (p): p is { type: string; reasoning: string } =>
      typeof p === "object" &&
      p !== null &&
      "type" in p &&
      (p as { type: string }).type === "reasoning" &&
      "reasoning" in p,
  )
  if (!reasoningPart) return null
  return String(reasoningPart.reasoning)
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  contentId: string
  onArtifactClick?: (artifactId: string) => void
}

export function ChatPanel({ contentId }: ChatPanelProps) {
  const router = useRouter()

  const { messages, status, sendMessage, cancel } =
    useHarnessChat(contentId)

  const isStreaming = status === "streaming"

  const handlePromptSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  // Map our local status to AI SDK ChatStatus for PromptInputSubmit
  const promptStatus =
    status === "streaming" ? ("streaming" as const) : status === "error" ? ("error" as const) : ("ready" as const)

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
        {isStreaming && (
          <Badge variant="secondary" className="ml-auto text-xs">
            Agent is working...
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
              const text = getMessageText(message)
              const reasoningText = getReasoningText(message)
              const isLastMessage = message === messages[messages.length - 1]
              const isAnimating = isStreaming && isLastMessage

              return (
                <Message key={message.id} from={message.role}>
                  {message.role === "assistant" && reasoningText && (
                    <Reasoning isStreaming={isAnimating}>
                      <ReasoningTrigger />
                      <ReasoningContent>{reasoningText}</ReasoningContent>
                    </Reasoning>
                  )}
                  <MessageContent>
                    {message.role === "assistant" ? (
                      <MessageResponse isAnimating={isAnimating}>
                        {text}
                      </MessageResponse>
                    ) : (
                      <span>{text}</span>
                    )}
                  </MessageContent>
                </Message>
              )
            })
          )}

          {isStreaming && messages.length === 0 && (
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
              Content Assistant
            </span>
            <PromptInputSubmit
              status={promptStatus}
              onStop={isStreaming ? cancel : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
