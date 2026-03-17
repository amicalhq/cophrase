"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChevronDownIcon, LoaderIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
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
import { extractTextFromParts as extractPartsText } from "@/lib/harness/utils"
import type { ContentType, ContentStage } from "@workspace/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatStatus = "ready" | "streaming" | "error"

interface HarnessMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  reasoningText?: string
  toolCalls?: ToolCallResult[]
  isError?: boolean
  createdAt: string
}

interface ToolCallResult {
  toolCallId: string
  toolName: string
  state: "calling" | "complete"
  input?: unknown
  result?: unknown
}

function isErrorMetadata(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "error" in metadata
  )
}

function extractToolCalls(metadata: unknown): ToolCallResult[] | undefined {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "toolCalls" in metadata &&
    Array.isArray((metadata as { toolCalls: unknown }).toolCalls)
  ) {
    return (metadata as { toolCalls: ToolCallResult[] }).toolCalls
  }
  return undefined
}

function extractReasoning(metadata: unknown): string | undefined {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "reasoning" in metadata &&
    typeof (metadata as { reasoning: unknown }).reasoning === "string"
  ) {
    return (metadata as { reasoning: string }).reasoning || undefined
  }
  return undefined
}

// ---------------------------------------------------------------------------
// SSE stream parser — extracts text, reasoning, and tool calls from the
// AI SDK UI message stream format
// ---------------------------------------------------------------------------

function parseSSEChunk(
  line: string,
  state: { text: string; reasoning: string; toolCalls: ToolCallResult[] },
) {
  if (!line.startsWith("data: ")) return
  const json = line.slice(6)
  if (!json || json === "[DONE]") return

  try {
    const evt = JSON.parse(json) as Record<string, unknown>
    const type = evt.type as string

    if (type === "text-delta" && typeof evt.delta === "string") {
      state.text += evt.delta
    } else if (
      type === "reasoning-delta" &&
      typeof evt.delta === "string"
    ) {
      state.reasoning += evt.delta
    } else if (type === "tool-input-start") {
      // Tool call started — deduplicate by toolCallId
      const id = (evt.toolCallId as string) ?? ""
      if (!state.toolCalls.some((t) => t.toolCallId === id)) {
        state.toolCalls.push({
          toolCallId: id,
          toolName: (evt.toolName as string) ?? "unknown",
          state: "calling",
        })
      }
    } else if (type === "tool-input-available") {
      // Tool input is ready — update with the input
      const id = evt.toolCallId as string
      const tc = state.toolCalls.find((t) => t.toolCallId === id)
      if (tc) {
        tc.input = evt.input
      }
    } else if (type === "tool-result" || type === "tool-output-available") {
      // Tool finished — AI SDK emits `tool-output-available` (not `tool-result`)
      const id = evt.toolCallId as string
      const output = evt.output ?? evt.result
      const tc = state.toolCalls.find((t) => t.toolCallId === id)
      if (tc) {
        tc.state = "complete"
        tc.result = output
      } else {
        state.toolCalls.push({
          toolCallId: id ?? "",
          toolName: (evt.toolName as string) ?? "unknown",
          state: "complete",
          result: output,
        })
      }
    }
  } catch {
    // ignore malformed lines
  }
}

// ---------------------------------------------------------------------------
// useHarnessChat hook
// ---------------------------------------------------------------------------

function useHarnessChat(contentId: string) {
  const [messages, setMessages] = useState<HarnessMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursorRef = useRef<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(
          `/api/content/${contentId}/messages?limit=20`,
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          messages: Array<{
            id: string
            role: string
            parts: unknown
            metadata: unknown
            createdAt: string
          }>
          nextCursor?: string
        }
        const converted: HarnessMessage[] = data.messages.map((m) => ({
          id: m.id,
          role: m.role as HarnessMessage["role"],
          content: extractPartsText(m.parts),
          reasoningText: extractReasoning(m.metadata),
          toolCalls: extractToolCalls(m.metadata),
          isError: isErrorMetadata(m.metadata),
          createdAt: m.createdAt,
        }))
        setMessages(converted.reverse())
        cursorRef.current = data.nextCursor ?? undefined
        setHasMore(!!data.nextCursor)
      } catch {
        // silently fail
      }
    }
    loadMessages()
  }, [contentId])

  // Load more (older) messages
  const loadMore = useCallback(async () => {
    if (!cursorRef.current || !hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/content/${contentId}/messages?cursor=${cursorRef.current}&limit=20`,
      )
      if (!res.ok) return
      const data = (await res.json()) as {
        messages: Array<{
          id: string
          role: string
          parts: unknown
          metadata: unknown
          createdAt: string
        }>
        nextCursor?: string
      }
      const converted: HarnessMessage[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role as HarnessMessage["role"],
        content: extractPartsText(m.parts),
        reasoningText: extractReasoning(m.metadata),
        toolCalls: extractToolCalls(m.metadata),
        isError: isErrorMetadata(m.metadata),
        createdAt: m.createdAt,
      }))
      setMessages((prev) => [...converted.reverse(), ...prev])
      cursorRef.current = data.nextCursor ?? undefined
      setHasMore(!!data.nextCursor)
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false)
    }
  }, [contentId, hasMore, loadingMore])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || status === "streaming") return

      const userMsg: HarnessMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setStatus("streaming")

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(`/api/content/${contentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        })

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
        const assistantMsgId = `assistant-${Date.now()}`
        const state = { text: "", reasoning: "", toolCalls: [] as ToolCallResult[] }
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? "" // keep incomplete line in buffer
          for (const line of lines) {
            parseSSEChunk(line.trim(), state)
          }

          // Update the assistant message
          setMessages((prev) => {
            const msg: HarnessMessage = {
              id: assistantMsgId,
              role: "assistant",
              content: state.text,
              reasoningText: state.reasoning || undefined,
              toolCalls: state.toolCalls.length > 0 ? [...state.toolCalls] : undefined,
              createdAt: new Date().toISOString(),
            }
            const existing = prev.find((m) => m.id === assistantMsgId)
            if (existing) {
              return prev.map((m) => (m.id === assistantMsgId ? msg : m))
            }
            return [...prev, msg]
          })
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          parseSSEChunk(buffer.trim(), state)
        }

        abortRef.current = null
        setStatus("ready")
      } catch (err) {
        abortRef.current = null
        // Don't treat abort as an error
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("ready")
        } else {
          setStatus("error")
        }
      }
    },
    [contentId, status],
  )

  // Cancel
  const cancel = useCallback(async () => {
    // Abort the in-flight fetch stream
    abortRef.current?.abort()
    abortRef.current = null

    try {
      await fetch(`/api/content/${contentId}/chat/cancel`, {
        method: "POST",
      })
      setStatus("ready")
    } catch {
      // silently fail
    }
  }, [contentId])

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  return {
    messages,
    status,
    hasMore,
    loadingMore,
    sendMessage,
    loadMore,
    cancel,
  }
}

// ---------------------------------------------------------------------------
// ToolCallBlock
// ---------------------------------------------------------------------------

function ToolCallBlock({
  toolCall,
  onArtifactClick,
}: {
  toolCall: ToolCallResult
  onArtifactClick?: (artifactId: string) => void
}) {
  const { toolName, state, input, result } = toolCall
  const label = formatToolLabel(toolName, input)
  const artifacts = extractArtifacts(result)
  const isCalling = state === "calling"

  return (
    <Collapsible className="not-prose my-2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground">
        <Badge
          variant={isCalling ? "secondary" : "outline"}
          className="h-5 px-1.5 text-[10px]"
        >
          {isCalling ? "Running" : "Tool"}
        </Badge>
        <span>
          {label}
          {isCalling && (
            <LoaderIcon className="ml-1 inline size-3 animate-spin" />
          )}
        </span>
        {!isCalling && (
          <ChevronDownIcon className="ml-auto size-3" />
        )}
      </CollapsibleTrigger>
      {!isCalling && (
        <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
          {artifacts.length > 0 && onArtifactClick && (
            <div className="mb-2 flex flex-wrap gap-1">
              {artifacts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="text-primary underline hover:no-underline text-xs"
                  onClick={() => onArtifactClick(a.id)}
                >
                  {a.title ?? a.type} v{a.version}
                </button>
              ))}
            </div>
          )}
          {result != null && (
            <pre className="bg-muted overflow-x-auto rounded-md p-2 text-[10px] max-h-40">
              {typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

function formatToolLabel(toolName: string, input?: unknown): string {
  const inp = input as Record<string, unknown> | undefined
  switch (toolName) {
    case "run-agent": {
      const agentId = inp?.agentId as string | undefined
      const name = agentId?.replace("builtin:", "") ?? "agent"
      return `Running ${name.replace(/-/g, " ")}`
    }
    case "get-content-status":
      return "Checking content status"
    case "search-artifacts":
      return "Searching artifacts"
    default:
      return toolName.replace(/-/g, " ")
  }
}

interface ArtifactRef {
  id: string
  type: string
  title?: string
  version: number
}

function extractArtifacts(result: unknown): ArtifactRef[] {
  if (!result || typeof result !== "object") return []
  const r = result as Record<string, unknown>
  if (Array.isArray(r.artifacts)) {
    return r.artifacts.filter(
      (a): a is ArtifactRef =>
        typeof a === "object" && a !== null && "id" in a && "type" in a,
    )
  }
  return []
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  contentId: string
  contentType: ContentType
  contentStage: ContentStage
  onArtifactClick?: (artifactId: string) => void
}

export function ChatPanel({ contentId, contentType, contentStage, onArtifactClick }: ChatPanelProps) {
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    status,
    hasMore,
    loadingMore,
    sendMessage,
    loadMore,
    cancel,
  } = useHarnessChat(contentId)

  const isStreaming = status === "streaming"

  const handlePromptSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  // Infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const scrollEl = container.querySelector(
      "[data-stick-to-bottom-scroll]",
    ) as HTMLElement | null
    if (!scrollEl) return

    function onScroll() {
      if (!hasMore || loadingMore) return
      if (scrollEl!.scrollTop < 80) {
        const prevHeight = scrollEl!.scrollHeight
        loadMore().then(() => {
          requestAnimationFrame(() => {
            scrollEl!.scrollTop = scrollEl!.scrollHeight - prevHeight
          })
        })
      }
    }

    scrollEl.addEventListener("scroll", onScroll)
    return () => scrollEl.removeEventListener("scroll", onScroll)
  }, [hasMore, loadingMore, loadMore])

  const promptStatus = isStreaming
    ? ("streaming" as const)
    : status === "error"
      ? ("error" as const)
      : ("ready" as const)

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
      <div ref={scrollContainerRef} className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {loadingMore && (
              <div className="flex items-center justify-center py-2">
                <LoaderIcon className="text-muted-foreground size-4 animate-spin" />
              </div>
            )}

            {messages.length === 0 && !loadingMore ? (
              <ConversationEmptyState
                title="Ask the AI agent"
                description="Ask the AI agent to help you write, edit, or improve your content."
              />
            ) : (
              messages.map((message) => {
                const isLastMessage =
                  message === messages[messages.length - 1]
                const isAnimating = isStreaming && isLastMessage

                return (
                  <Message key={message.id} from={message.role}>
                    {message.role === "assistant" &&
                      message.reasoningText && (
                        <Reasoning isStreaming={isAnimating} defaultOpen={false}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.reasoningText}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                    {message.role === "assistant" &&
                      message.toolCalls?.map((tc, i) => (
                        <ToolCallBlock
                          key={`${message.id}-tool-${i}`}
                          toolCall={tc}
                          onArtifactClick={onArtifactClick}
                        />
                      ))}
                    <MessageContent>
                      {message.isError ? (
                        <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                          {message.content}
                        </div>
                      ) : message.role === "assistant" ? (
                        <MessageResponse isAnimating={isAnimating}>
                          {message.content}
                        </MessageResponse>
                      ) : (
                        <span>{message.content}</span>
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
      </div>

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
