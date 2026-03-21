"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { trpc } from "@/lib/trpc/client"

interface AgentTool {
  id: string
  type: string
  referenceId: string
  required: boolean
}

const AVAILABLE_FUNCTION_TOOLS = [
  { referenceId: "web-search", label: "Web Search" },
]

interface AgentToolsEditorProps {
  agentId: string
  initialTools: AgentTool[]
}

export function AgentToolsEditor({
  agentId,
  initialTools,
}: AgentToolsEditorProps) {
  const [tools, setTools] = useState<AgentTool[]>(initialTools)
  const [selectedTool, setSelectedTool] = useState("")
  const [error, setError] = useState("")

  const existingRefs = new Set(tools.map((t) => t.referenceId))
  const availableToAdd = AVAILABLE_FUNCTION_TOOLS.filter(
    (t) => !existingRefs.has(t.referenceId),
  )

  const addTool = trpc.agents.addTool.useMutation({
    onSuccess: (newTool) => {
      setTools((prev) => [...prev, newTool as AgentTool])
      setSelectedTool("")
    },
    onError: (err) => {
      setError(err.message ?? "Failed to add tool")
    },
  })

  const removeTool = trpc.agents.removeTool.useMutation({
    onSuccess: (_data, variables) => {
      setTools((prev) => prev.filter((t) => t.id !== variables.toolId))
    },
    onError: (err) => {
      setError(err.message ?? "Failed to remove tool")
    },
  })

  function handleAdd() {
    if (!selectedTool) return
    setError("")
    addTool.mutate({
      agentId,
      type: "function",
      referenceId: selectedTool,
      required: false,
    })
  }

  function handleRemove(toolId: string) {
    setError("")
    removeTool.mutate({ agentId, toolId })
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Tools</Label>
      {tools.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tools configured</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tools.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded border px-3 py-1.5 text-sm"
            >
              <span>
                {t.referenceId}{" "}
                <span className="text-xs text-muted-foreground">({t.type})</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive"
                onClick={() => handleRemove(t.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedTool} onValueChange={setSelectedTool}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add a tool..." />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((t) => (
                <SelectItem key={t.referenceId} value={t.referenceId}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedTool || addTool.isPending}
            onClick={handleAdd}
          >
            {addTool.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
