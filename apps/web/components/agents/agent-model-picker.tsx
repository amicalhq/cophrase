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
import { trpc } from "@/lib/trpc/client"

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
  const [error, setError] = useState("")

  const updateAgent = trpc.agents.update.useMutation({
    onError: (err) => {
      setError(err.message ?? "Failed to save")
      setSelectedId(currentModelId ?? "default")
    },
  })

  function handleChange(value: string) {
    setSelectedId(value)
    setError("")

    const modelId = value === "default" ? null : value
    updateAgent.mutate({ id: agentId, modelId })
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Model</Label>
      <Select value={selectedId} onValueChange={handleChange} disabled={updateAgent.isPending}>
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
