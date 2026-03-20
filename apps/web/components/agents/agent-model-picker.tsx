"use client"

import { useState } from "react"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

interface ModelOption {
  id: string
  name: string
  provider: string
}

interface AgentModelPickerProps {
  agentId: string
  currentModelId: string | null
  models: ModelOption[]
}

export function AgentModelPicker({
  agentId,
  currentModelId,
  models,
}: AgentModelPickerProps) {
  const [selectedId, setSelectedId] = useState(currentModelId ?? "default")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleChange(value: string) {
    setSelectedId(value)
    setSaving(true)
    setError("")

    const modelId = value === "default" ? null : value

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to save")
        setSelectedId(currentModelId ?? "default")
      }
    } catch {
      setError("Failed to save")
      setSelectedId(currentModelId ?? "default")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Model</Label>
      <Select value={selectedId} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Organization default</SelectItem>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name} ({m.provider})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
