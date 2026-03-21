"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckIcon, ChevronDownIcon, LoaderIcon, XIcon } from "lucide-react"
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
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion"
import { useQueryState } from "nuqs"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import type { ArtifactData } from "./artifact-viewer"
import { typeLabel, sortedTypeKeys } from "./artifact-picker"
import { FrontmatterForm } from "./frontmatter-form"
import { extractTextFromParts as extractPartsText } from "@/lib/harness/utils"
import type { PromptSuggestion } from "@/lib/harness/suggestions"
import { trpc } from "@/lib/trpc/client"
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGEST_TOOL_NAME = "suggest-next-actions" as const

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
  state: "calling" | "complete" | "stopped"
  input?: unknown
  result?: unknown
}

function isErrorMetadata(metadata: unknown): boolean {
  return (
    typeof metadata === "object" && metadata !== null && "error" in metadata
  )
}

function extractToolCalls(metadata: unknown): ToolCallResult[] | undefined {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "toolCalls" in metadata &&
    Array.isArray((metadata as { toolCalls: unknown }).toolCalls)
  ) {
    return (metadata as { toolCalls: ToolCallResult[] }).toolCalls.filter(
      (tc) => tc.toolName !== SUGGEST_TOOL_NAME
    )
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
  state: { text: string; reasoning: string; toolCalls: ToolCallResult[] }
) {
  if (!line.startsWith("data: ")) return
  const json = line.slice(6)
  if (!json || json === "[DONE]") return

  try {
    const evt = JSON.parse(json) as Record<string, unknown>
    const type = evt.type as string

    if (type === "text-delta" && typeof evt.delta === "string") {
      state.text += evt.delta
    } else if (type === "reasoning-delta" && typeof evt.delta === "string") {
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
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([])
  const pendingSuggestionsRef = useRef<PromptSuggestion[] | null>(null)
  const utils = trpc.useUtils()
  const cancelMutation = trpc.content.cancelChat.useMutation()

  // Load messages from API — used on initial mount and after stream ends
  const loadMessages = useCallback(async () => {
    try {
      const data = await utils.content.messages.fetch({ contentId })
      const converted: HarnessMessage[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role as HarnessMessage["role"],
        content: extractPartsText(m.parts ?? null),
        reasoningText: extractReasoning(m.metadata ?? null),
        toolCalls: extractToolCalls(m.metadata ?? null),
        isError: isErrorMetadata(m.metadata ?? null),
        createdAt: m.createdAt,
      }))
      setMessages(converted.reverse())
      cursorRef.current = data.nextCursor ?? undefined
      setHasMore(!!data.nextCursor)

      // Populate suggestions
      if (converted.length === 0) {
        // Empty conversation — fetch initial suggestions from API
        try {
          const sugData = await utils.content.suggestions.fetch({ contentId })
          setSuggestions(sugData.suggestions)
        } catch {
          // silently fail
        }
      } else {
        // Existing conversation — extract from raw metadata (before extractToolCalls filters it)
        const lastAssistantRaw = [...data.messages]
          .reverse()
          .find((m) => m.role === "assistant")
        if (lastAssistantRaw?.metadata) {
          const allToolCalls = (
            lastAssistantRaw.metadata as { toolCalls?: ToolCallResult[] }
          ).toolCalls
          const suggestTc = allToolCalls?.find(
            (tc) => tc.toolName === SUGGEST_TOOL_NAME
          )
          if (suggestTc?.input) {
            const inp = suggestTc.input as {
              suggestions?: PromptSuggestion[]
            }
            if (Array.isArray(inp.suggestions)) {
              setSuggestions(inp.suggestions)
            }
          }
        }
      }
    } catch {
      // silently fail
    }
  }, [contentId, utils])

  // Load initial messages
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Load more (older) messages
  const loadMore = useCallback(async () => {
    if (!cursorRef.current || !hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await utils.content.messages.fetch({
        contentId,
        cursor: cursorRef.current,
        limit: 20,
      })
      const converted: HarnessMessage[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role as HarnessMessage["role"],
        content: extractPartsText(m.parts ?? null),
        reasoningText: extractReasoning(m.metadata ?? null),
        toolCalls: extractToolCalls(m.metadata ?? null),
        isError: isErrorMetadata(m.metadata ?? null),
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
  }, [contentId, hasMore, loadingMore, utils])

  // Send message
  const sendMessage = useCallback(
    async (text: string, modelId?: string) => {
      if (!text.trim() || status === "streaming") return

      const userMsg: HarnessMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setStatus("streaming")
      setSuggestions([])
      pendingSuggestionsRef.current = null

      const controller = new AbortController()
      abortRef.current = controller

      const assistantMsgId = `assistant-${Date.now()}`
      const state = {
        text: "",
        reasoning: "",
        toolCalls: [] as ToolCallResult[],
      }

      try {
        const res = await fetch(`/api/content/${contentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, modelId }),
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
            // Extract suggestions from suggest-next-actions tool input
            for (const tc of state.toolCalls) {
              if (tc.toolName === SUGGEST_TOOL_NAME && tc.input) {
                const inp = tc.input as {
                  suggestions?: PromptSuggestion[]
                }
                if (Array.isArray(inp.suggestions)) {
                  pendingSuggestionsRef.current = inp.suggestions
                }
              }
            }
          }

          // Update the assistant message
          setMessages((prev) => {
            const msg: HarnessMessage = {
              id: assistantMsgId,
              role: "assistant",
              content: state.text,
              reasoningText: state.reasoning || undefined,
              toolCalls:
                state.toolCalls.length > 0
                  ? state.toolCalls.filter(
                      (tc) => tc.toolName !== SUGGEST_TOOL_NAME
                    )
                  : undefined,
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

        // Flush pending suggestions
        if (pendingSuggestionsRef.current) {
          setSuggestions(pendingSuggestionsRef.current)
          pendingSuggestionsRef.current = null
        }

        setStatus("ready")
      } catch (err) {
        abortRef.current = null
        // Flush any pending suggestions even on error
        if (pendingSuggestionsRef.current) {
          setSuggestions(pendingSuggestionsRef.current)
          pendingSuggestionsRef.current = null
        }
        // Don't treat abort as an error
        if (err instanceof DOMException && err.name === "AbortError") {
          // Mark any in-flight tool calls as stopped
          for (const tc of state.toolCalls) {
            if (tc.state === "calling") {
              tc.state = "stopped"
            }
          }
          // Flush final message state so the UI reflects stopped tools
          setMessages((prev) => {
            const msg: HarnessMessage = {
              id: assistantMsgId,
              role: "assistant",
              content: state.text,
              reasoningText: state.reasoning || undefined,
              toolCalls:
                state.toolCalls.length > 0
                  ? state.toolCalls.filter(
                      (tc) => tc.toolName !== SUGGEST_TOOL_NAME
                    )
                  : undefined,
              createdAt: new Date().toISOString(),
            }
            const existing = prev.find((m) => m.id === assistantMsgId)
            if (existing) {
              return prev.map((m) => (m.id === assistantMsgId ? msg : m))
            }
            return [...prev, msg]
          })
          setStatus("ready")
        } else {
          setStatus("error")
        }
      }
    },
    [contentId, status]
  )

  // Cancel
  const cancel = useCallback(async () => {
    // Abort the in-flight fetch stream
    abortRef.current?.abort()
    abortRef.current = null

    try {
      cancelMutation.mutate({ contentId })
      setStatus("ready")
    } catch {
      // silently fail
    }
  }, [contentId, cancelMutation])

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
    suggestions,
    hasMore,
    loadingMore,
    sendMessage,
    loadMore,
    cancel,
  }
}

// ---------------------------------------------------------------------------
// SubAgentRow — collapsible row for a single sub-agent result
// ---------------------------------------------------------------------------

function SubAgentRow({
  agent,
  onArtifactClick,
}: {
  agent: {
    agentName: string
    success: boolean
    artifacts: ArtifactRef[]
    error?: string
    durationMs?: number
    reasoningText?: string
  }
  onArtifactClick?: (artifactId: string) => void
}) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="text-muted-foreground/60">↳</span>
        {agent.success ? (
          <CheckIcon className="size-3 text-green-600" />
        ) : (
          <XIcon className="size-3 text-destructive" />
        )}
        <span>{agent.agentName}</span>
        <ChevronDownIcon className="ml-auto size-3" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 pl-7 text-xs text-muted-foreground">
        {agent.success ? (
          agent.artifacts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {agent.artifacts.map((a) =>
                onArtifactClick ? (
                  <button
                    key={a.id}
                    type="button"
                    className="text-primary underline hover:no-underline"
                    onClick={() => onArtifactClick(a.id)}
                  >
                    {a.title ?? a.type} v{a.version}
                  </button>
                ) : (
                  <span key={a.id}>
                    {a.title ?? a.type} v{a.version}
                  </span>
                )
              )}
            </div>
          ) : null
        ) : (
          <p className="text-destructive">
            Failed{agent.error ? `: ${agent.error}` : ""}
          </p>
        )}
        {agent.reasoningText ? (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              <ChevronDownIcon className="size-3" />
              Thought
              {agent.durationMs != null && agent.durationMs > 0 && (
                <span> for {Math.round(agent.durationMs / 1000)}s</span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
              {agent.reasoningText}
            </CollapsibleContent>
          </Collapsible>
        ) : agent.durationMs != null && agent.durationMs > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Thought for {Math.round(agent.durationMs / 1000)}s
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// RunStageBlock — stage → sub-agent hierarchy for run-stage tool calls
// ---------------------------------------------------------------------------

function RunStageBlock({
  toolCall,
  onArtifactClick,
}: {
  toolCall: ToolCallResult
  onArtifactClick?: (artifactId: string) => void
}) {
  const { state, input, result } = toolCall
  const inp = input as Record<string, unknown> | undefined
  const res = result as Record<string, unknown> | undefined

  const stageName =
    (res?.stageName as string | undefined) ??
    (inp?.stageName as string | undefined) ??
    "Stage"
  const agentNames = (inp?.agentNames ?? []) as string[]
  const isStopped = state === "stopped"
  const isComplete = state === "complete"

  // Completed state — collapsible stage with sub-agent rows
  if (isComplete) {
    const success = res?.success as boolean | undefined
    const subAgentResults = (res?.subAgentResults ?? []) as Array<{
      agentName: string
      success: boolean
      artifacts: ArtifactRef[]
      error?: string
      durationMs?: number
      reasoningText?: string
    }>

    return (
      <div className="not-prose my-2 space-y-1">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            {success !== false ? (
              <Badge className="h-5 gap-1 border-green-600/30 bg-green-500/10 px-1.5 text-[10px] text-green-600">
                <CheckIcon className="size-3" />
                Done
              </Badge>
            ) : (
              <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
                <XIcon className="size-3" />
                Failed
              </Badge>
            )}
            <span>{stageName}</span>
            {subAgentResults.length > 0 && <ChevronDownIcon className="ml-auto size-3" />}
          </CollapsibleTrigger>
          {subAgentResults.length > 0 && (
            <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {subAgentResults.map((sr, i) => (
                <SubAgentRow
                  key={i}
                  agent={sr}
                  onArtifactClick={onArtifactClick}
                />
              ))}
              {typeof res?.error === "string" && (
                <p className="text-destructive">{res.error}</p>
              )}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    )
  }

  // Stopped state
  if (isStopped) {
    return (
      <div className="not-prose my-2 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
            <XIcon className="size-3" />
            Stopped
          </Badge>
          <span>{stageName}</span>
        </div>
        {agentNames.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground"
          >
            <span className="text-muted-foreground/60">↳</span>
            <XIcon className="size-3 text-destructive" />
            <span>{name}</span>
          </div>
        ))}
      </div>
    )
  }

  // Calling state — stage row + sub-agent running rows
  return (
    <div className="not-prose my-2 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
          <LoaderIcon className="size-3 animate-spin" />
          Running
        </Badge>
        <span>
          {stageName}
          {agentNames.length > 1 && (
            <span className="ml-1 text-muted-foreground/60">
              · {agentNames.length} agents
            </span>
          )}
        </span>
      </div>
      {agentNames.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground"
          >
            <span className="text-muted-foreground/60">↳</span>
            <LoaderIcon className="size-3 animate-spin" />
            <span>{name}</span>
          </div>
      ))}
    </div>
  )
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
  // Route run-stage to its dedicated component
  if (toolCall.toolName === "run-stage") {
    return (
      <RunStageBlock toolCall={toolCall} onArtifactClick={onArtifactClick} />
    )
  }

  const { toolName, state, input, result } = toolCall
  const label = formatToolLabel(toolName, input, result)
  const isCalling = state === "calling"
  const isStopped = state === "stopped"

  return (
    <div className="not-prose my-2 space-y-1">
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          {isCalling ? (
            <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
              <LoaderIcon className="size-3 animate-spin" />
              Running
            </Badge>
          ) : isStopped ? (
            <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
              <XIcon className="size-3" />
              Stopped
            </Badge>
          ) : (
            <Badge className="h-5 gap-1 border-green-600/30 bg-green-500/10 px-1.5 text-[10px] text-green-600">
              <CheckIcon className="size-3" />
              Done
            </Badge>
          )}
          <span>{label}</span>
          {!isCalling && !isStopped && <ChevronDownIcon className="ml-auto size-3" />}
        </CollapsibleTrigger>
        {!isCalling && !isStopped && (
          <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
            <ToolResultDisplay
              toolName={toolName}
              result={result}
              onArtifactClick={onArtifactClick}
            />
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToolResultDisplay — human-readable result for known tools, raw JSON fallback
// ---------------------------------------------------------------------------

function ToolResultDisplay({
  toolName,
  result,
  onArtifactClick,
}: {
  toolName: string
  result: unknown
  onArtifactClick?: (artifactId: string) => void
}) {
  if (result == null) return null

  const res = typeof result === "object" ? (result as Record<string, unknown>) : null

  // get-content-status: show stage position, title, and artifacts
  if (toolName === "get-content-status" && res) {
    const title = res.title as string | undefined
    const currentStageName = res.currentStageName as string | undefined
    const stagePosition = res.stagePosition as number | null | undefined
    const totalStages = res.totalStages as number | undefined
    const statusArtifacts = (res.artifacts ?? []) as Array<{
      id: string
      type: string
      title: string
      version: number
      status: string
    }>
    return (
      <div className="space-y-1.5">
        {title && <p className="font-medium">{title}</p>}
        {currentStageName ? (
          <p>
            Stage: {currentStageName}
            {stagePosition != null && totalStages
              ? ` (${stagePosition}/${totalStages})`
              : ""}
          </p>
        ) : (
          <p>Stage: Not started</p>
        )}
        {statusArtifacts.length > 0 && (
          <ul className="list-inside list-disc space-y-0.5">
            {statusArtifacts.map((a) => (
              <li key={a.id}>
                {onArtifactClick ? (
                  <button
                    type="button"
                    className="text-primary underline hover:no-underline"
                    onClick={() => onArtifactClick(a.id)}
                  >
                    {a.title}
                  </button>
                ) : (
                  a.title
                )}{" "}
                <span className="text-muted-foreground">
                  v{a.version} · {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // search-artifacts: show count and list
  if (toolName === "search-artifacts" && res) {
    const count = res.count as number | undefined
    const searchArtifacts = (res.artifacts ?? []) as Array<{
      id: string
      type: string
      title: string
      version: number
      status: string
    }>
    return (
      <div className="space-y-1.5">
        <p>Found {count ?? searchArtifacts.length} artifact(s)</p>
        {searchArtifacts.length > 0 && (
          <ul className="list-inside list-disc space-y-0.5">
            {searchArtifacts.map((a) => (
              <li key={a.id}>
                {onArtifactClick ? (
                  <button
                    type="button"
                    className="text-primary underline hover:no-underline"
                    onClick={() => onArtifactClick(a.id)}
                  >
                    {a.title}
                  </button>
                ) : (
                  a.title
                )}{" "}
                <span className="text-muted-foreground">
                  {a.type} v{a.version} · {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // save-artifact: show what was saved
  if (toolName === "save-artifact" && res) {
    const type = res.type as string | undefined
    const version = res.version as number | undefined
    return (
      <p>
        Saved {type ?? "artifact"}
        {version != null && ` v${version}`}
      </p>
    )
  }

  // load-artifact: show loaded artifact summary
  if (toolName === "load-artifact" && res && !res.error) {
    const loadedTitle = res.title as string | undefined
    const type = res.type as string | undefined
    const version = res.version as number | undefined
    return (
      <p>
        Loaded{" "}
        <span className="font-medium">{loadedTitle ?? type ?? "artifact"}</span>
        {version != null && ` v${version}`}
      </p>
    )
  }

  // web-search: show result links
  if (toolName === "web-search" && res) {
    const results = res.results as
      | Array<{ title: string; url: string; snippet?: string }>
      | undefined
    if (results && results.length > 0) {
      return (
        <ul className="list-inside list-disc space-y-0.5">
          {results.map((r, i) => (
            <li key={i}>
              <span className="font-medium">{r.title}</span>
              {r.snippet && (
                <span className="text-muted-foreground">
                  {" — "}
                  {r.snippet.slice(0, 120)}
                  {r.snippet.length > 120 && "…"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )
    }
  }

  // Fallback: raw JSON
  return (
    <pre className="max-h-40 overflow-x-auto rounded-md bg-muted p-2 text-[10px]">
      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
    </pre>
  )
}

function formatToolLabel(
  toolName: string,
  input?: unknown,
  result?: unknown
): string {
  const inp = input as Record<string, unknown> | undefined
  const res = result as Record<string, unknown> | undefined
  switch (toolName) {
    case "run-stage": {
      const stageName =
        (res?.stageName as string | undefined) ??
        (inp?.stageName as string | undefined)
      return stageName ?? "Stage"
    }
    case "get-content-status":
      return "Content status"
    case "search-artifacts":
      return "Artifact search"
    case "save-artifact": {
      const title = inp?.title as string | undefined
      return title ? `Save "${title}"` : "Save artifact"
    }
    case "load-artifact": {
      const loadedTitle = (res?.title as string | undefined) ?? undefined
      return loadedTitle ? `Load "${loadedTitle}"` : "Load artifact"
    }
    case "web-search": {
      const query = inp?.query as string | undefined
      return query ? `Search "${query}"` : "Web search"
    }
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

// ---------------------------------------------------------------------------
// ArtifactsList component
// ---------------------------------------------------------------------------

function ArtifactsList({
  artifacts,
  grouped,
  selectedId,
  onArtifactClick,
}: {
  artifacts: ArtifactData[]
  grouped: Record<string, ArtifactData[]>
  selectedId: string | null
  onArtifactClick?: (artifactId: string) => void
}) {
  if (artifacts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          No artifacts yet. Ask the AI agent to generate content.
        </p>
      </div>
    )
  }

  const types = sortedTypeKeys(Object.keys(grouped))

  return (
    <div className="space-y-4 p-3">
      {types.map((type) => (
        <div key={type}>
          <h3 className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            {typeLabel(type)}
          </h3>
          <div className="space-y-0.5">
            {grouped[type]!.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                onClick={() => onArtifactClick?.(artifact.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedId === artifact.id && "bg-muted"
                )}
              >
                <span className="flex-1 truncate">{artifact.title}</span>
                <Badge
                  variant="secondary"
                  className="h-4 shrink-0 px-1 text-[10px]"
                >
                  v{artifact.version}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

export interface ChatModelOption {
  id: string
  modelId: string
  providerType: string
  isDefault: boolean
}

interface ChatPanelProps {
  contentId: string
  onArtifactClick?: (artifactId: string) => void
  artifacts: ArtifactData[]
  groupedArtifacts: Record<string, ArtifactData[]>
  selectedArtifactId: string | null
  languageModels: ChatModelOption[]
}

export function ChatPanel({
  contentId,
  onArtifactClick,
  artifacts,
  groupedArtifacts,
  selectedArtifactId,
  languageModels,
}: ChatPanelProps) {
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "agent",
  })
  const defaultModelId =
    languageModels.find((m) => m.isDefault)?.id ?? languageModels[0]?.id ?? ""
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId)

  // Re-sync selection if models list changes (model added/deleted)
  useEffect(() => {
    if (
      languageModels.length > 0 &&
      !languageModels.some((m) => m.id === selectedModelId)
    ) {
      setSelectedModelId(defaultModelId)
    }
  }, [languageModels, selectedModelId, defaultModelId])

  const {
    messages,
    status,
    suggestions,
    hasMore,
    loadingMore,
    sendMessage,
    loadMore,
    cancel,
  } = useHarnessChat(contentId)

  const isStreaming = status === "streaming"

  const handlePromptSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      sendMessage(text, selectedModelId || undefined)
    },
    [sendMessage, selectedModelId]
  )

  // Infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const scrollEl = container.querySelector(
      "[data-stick-to-bottom-scroll]"
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
      {/* Header with tabs */}
      <div className="flex h-11 items-center gap-1 border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
        </Button>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="agent">AI Agent</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="artifacts">
              Artifacts
              {artifacts.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {artifacts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {isStreaming && activeTab === "agent" && (
          <Badge variant="secondary" className="ml-auto text-xs">
            Agent is working...
          </Badge>
        )}
      </div>

      {/* AI Agent tab */}
      <div
        className={
          activeTab === "agent" ? "flex min-h-0 flex-1 flex-col" : "hidden"
        }
      >
        {/* Messages area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-hidden">
          <Conversation className="h-full">
            <ConversationContent>
              {loadingMore && (
                <div className="flex items-center justify-center py-2">
                  <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
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
                          <Reasoning
                            isStreaming={isAnimating}
                            defaultOpen={false}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>
                              {message.reasoningText}
                            </ReasoningContent>
                          </Reasoning>
                        )}
                      {message.role === "assistant" &&
                        message.toolCalls
                          ?.filter((tc) => tc.toolName !== SUGGEST_TOOL_NAME)
                          .map((tc, i) => (
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
                    <span className="animate-pulse text-sm text-muted-foreground">
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

        {/* Suggestions */}
        {status !== "streaming" && suggestions.length > 0 && (
          <div className="px-3 py-2">
            <Suggestions>
              {suggestions.map((s) => (
                <Suggestion
                  key={s.label}
                  suggestion={s.prompt}
                  variant={s.primary ? "default" : "outline"}
                  onClick={(prompt) =>
                    sendMessage(prompt, selectedModelId || undefined)
                  }
                >
                  {s.label}
                </Suggestion>
              ))}
            </Suggestions>
          </div>
        )}

        {/* Prompt input */}
        <div className="border-t p-3">
          <PromptInput onSubmit={handlePromptSubmit}>
            <PromptInputTextarea placeholder="Ask the AI agent..." />
            <PromptInputFooter>
              {languageModels.length > 0 ? (
                <PromptInputSelect
                  value={selectedModelId}
                  onValueChange={setSelectedModelId}
                >
                  <PromptInputSelectTrigger className="h-7 w-auto gap-1.5 px-2 text-xs">
                    <PromptInputSelectValue placeholder="Select model" />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {languageModels.map((m) => (
                      <PromptInputSelectItem key={m.id} value={m.id}>
                        {m.modelId}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              ) : (
                <span className="text-xs text-muted-foreground">
                  No models configured
                </span>
              )}
              <PromptInputSubmit
                status={promptStatus}
                onStop={isStreaming ? cancel : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      {/* Details tab */}
      <div
        className={
          activeTab === "details" ? "flex-1 overflow-y-auto" : "hidden"
        }
      >
        <FrontmatterForm contentId={contentId} />
      </div>

      {/* Artifacts tab */}
      <div
        className={
          activeTab === "artifacts" ? "flex-1 overflow-y-auto" : "hidden"
        }
      >
        <ArtifactsList
          artifacts={artifacts}
          grouped={groupedArtifacts}
          selectedId={selectedArtifactId}
          onArtifactClick={onArtifactClick}
        />
      </div>
    </div>
  )
}
