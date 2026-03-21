"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { trpc } from "@/lib/trpc/client"

interface AgentPromptEditorProps {
  agentId: string
  label: string
  initialPrompt: string
  onSaved?: () => void
}

export function AgentPromptEditor({
  agentId,
  label,
  initialPrompt,
  onSaved,
}: AgentPromptEditorProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const isDirty = prompt !== initialPrompt

  const updateAgent = trpc.agents.update.useMutation({
    onSuccess: () => {
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => {
      setError(err.message ?? "Failed to save")
    },
  })

  function handleSave() {
    setError("")
    setSaved(false)
    updateAgent.mutate({ id: agentId, prompt })
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Textarea
        className="min-h-[120px]"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!isDirty || updateAgent.isPending} onClick={handleSave}>
          {updateAgent.isPending ? "Saving..." : "Save prompt"}
        </Button>
        {saved && (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
