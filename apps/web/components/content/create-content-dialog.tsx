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
import { trpc } from "@/lib/trpc/client"

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

  // Post-creation state
  const [phase, setPhase] = useState<"create" | "created">("create")
  const [createdContentId, setCreatedContentId] = useState("")

  const createMutation = trpc.content.create.useMutation()

  const selectedType = contentTypes.find((ct) => ct.id === contentTypeId)
  const createdTitle = title.trim() || "Untitled"

  function resetAndClose() {
    setOpen(false)
    setPhase("create")
    setTitle("")
    setCreatedContentId("")
    setContentTypeId(contentTypes[0]?.id ?? "")
    setError("")
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const created = await createMutation.mutateAsync({
        projectId,
        orgId,
        title: title.trim() || undefined,
        contentTypeId,
      })
      setCreatedContentId(created.id)
      setPhase("created")
      setLoading(false)
    } catch (err) {
      console.error("Failed to create content:", err)
      const message =
        err instanceof Error ? err.message : "Something went wrong"
      setError(message)
      setLoading(false)
    }
  }

  function handleOpenInEditor() {
    const editUrl = `/orgs/${orgId}/projects/${projectId}/content/${createdContentId}/edit`
    resetAndClose()
    router.push(editUrl)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetAndClose()
        } else {
          setOpen(true)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">New content</Button>
      </DialogTrigger>
      <DialogContent>
        {phase === "create" ? (
          <>
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
                    Title{" "}
                    <span className="text-muted-foreground">(optional)</span>
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Content created</DialogTitle>
              <DialogDescription>
                Your {selectedType?.name ?? "content"} is ready.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4">
              <p className="font-medium">{createdTitle}</p>
              {selectedType && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedType.name}
                  {selectedType.description
                    ? ` — ${selectedType.description}`
                    : ""}
                </p>
              )}
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={resetAndClose}>
                Pick up later
              </Button>
              <Button onClick={handleOpenInEditor}>✨ Open in AI Editor</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
