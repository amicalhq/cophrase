"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const isDirty = prompt !== initialPrompt

  async function handleSave() {
    setSaving(true)
    setError("")
    setSaved(false)

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to save")
        return
      }

      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to save")
    } finally {
      setSaving(false)
    }
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
        <Button size="sm" disabled={!isDirty || saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save prompt"}
        </Button>
        {saved && (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
