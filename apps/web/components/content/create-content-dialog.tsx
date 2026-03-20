"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

interface ContentTypeOption {
  id: string
  name: string
  description: string | null
}

export function CreateContentDialog({
  orgId,
  projectId,
  contentTypes,
}: {
  orgId: string
  projectId: string
  contentTypes: ContentTypeOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [contentTypeId, setContentTypeId] = useState<string>(
    contentTypes[0]?.id ?? ""
  )
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          orgId,
          title: title.trim() || undefined,
          contentTypeId,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          setError(data.error ?? "Failed to create content")
        } catch {
          setError("Failed to create content")
        }
        setLoading(false)
        return
      }

      setLoading(false)
      setOpen(false)
      setTitle("")
      setContentTypeId(contentTypes[0]?.id ?? "")
      router.refresh()
    } catch (error) {
      console.error("Failed to create content:", error)
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New content</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New content</DialogTitle>
          <DialogDescription>
            Create a new content piece for this project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="content-title">
                Title <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="content-title"
                placeholder="e.g. How to Scale Your Startup"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <div className="flex gap-3">
                {contentTypes.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => setContentTypeId(ct.id)}
                    className={cn(
                      "flex-1 rounded-lg border-2 p-4 text-center transition-colors",
                      contentTypeId === ct.id
                        ? "border-foreground bg-accent"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <p className="text-sm font-medium">{ct.name}</p>
                    {ct.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ct.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
