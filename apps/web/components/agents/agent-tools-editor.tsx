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
  const [adding, setAdding] = useState(false)
  const [selectedTool, setSelectedTool] = useState("")
  const [error, setError] = useState("")

  const existingRefs = new Set(tools.map((t) => t.referenceId))
  const availableToAdd = AVAILABLE_FUNCTION_TOOLS.filter(
    (t) => !existingRefs.has(t.referenceId),
  )

  async function handleAdd() {
    if (!selectedTool) return
    setAdding(true)
    setError("")

    try {
      const res = await fetch(`/api/agents/${agentId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "function",
          referenceId: selectedTool,
          required: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to add tool")
        return
      }

      const newTool = await res.json()
      setTools((prev) => [...prev, newTool])
      setSelectedTool("")
    } catch {
      setError("Failed to add tool")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(toolId: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/tools/${toolId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to remove tool")
        return
      }

      setTools((prev) => prev.filter((t) => t.id !== toolId))
    } catch {
      setError("Failed to remove tool")
    }
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
            disabled={!selectedTool || adding}
            onClick={handleAdd}
          >
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
