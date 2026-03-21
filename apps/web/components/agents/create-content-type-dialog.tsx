"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { FrontmatterSchemaEditor } from "./frontmatter-schema-editor"

interface CreateContentTypeDialogProps {
  orgId: string
  projectId: string
  onCreated?: () => void
}

const FORMAT_OPTIONS = [
  { value: "rich_text", label: "Rich Text" },
  { value: "plain_text", label: "Plain Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "deck", label: "Deck" },
]

type Step = 1 | 2 | 3

export function CreateContentTypeDialog({
  orgId,
  projectId,
  onCreated,
}: CreateContentTypeDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Step 1
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [format, setFormat] = useState("rich_text")

  // Step 2
  const [frontmatterSchema, setFrontmatterSchema] = useState<
    Record<string, unknown>
  >({ type: "object", properties: {} })

  // Step 3
  const [stageNames, setStageNames] = useState<string[]>([""])

  function reset() {
    setStep(1)
    setName("")
    setDescription("")
    setFormat("rich_text")
    setFrontmatterSchema({ type: "object", properties: {} })
    setStageNames([""])
    setError("")
    setSubmitting(false)
  }

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) reset()
  }

  function handleStep1Next() {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setError("")
    setStep(2)
  }

  function handleSchemaCapture(schema: Record<string, unknown>) {
    setFrontmatterSchema(schema)
    setStep(3)
  }

  function addStage() {
    setStageNames((prev) => [...prev, ""])
  }

  function removeStage(index: number) {
    setStageNames((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStage(index: number, value: string) {
    setStageNames((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  const createMutation = trpc.contentTypes.create.useMutation({
    onSuccess() {
      onCreated?.()
      setOpen(false)
      reset()
    },
    onError(err) {
      setError(err.message ?? "Failed to create content type")
      setSubmitting(false)
    },
  })

  async function handleSubmit() {
    setSubmitting(true)
    setError("")

    const stages = stageNames
      .map((n, i) => ({ name: n, position: i + 1 }))
      .filter((s) => s.name.trim() !== "")

    createMutation.mutate({
      projectId,
      orgId,
      name,
      description,
      format: format as "rich_text" | "plain_text" | "image" | "video" | "deck",
      frontmatterSchema,
      stages,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Create from scratch</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Create content type</DialogTitle>
              <DialogDescription>
                Step 1 of 3 — Give your content type a name and format.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ct-name">Name</Label>
                <Input
                  id="ct-name"
                  placeholder="Blog post"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ct-description">Description</Label>
                <Textarea
                  id="ct-description"
                  placeholder="A short-form article for the company blog."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button onClick={handleStep1Next}>Next</Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Frontmatter fields</DialogTitle>
              <DialogDescription>
                Step 2 of 3 — Define optional frontmatter fields for this
                content type.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <FrontmatterSchemaEditor
                initialSchema={frontmatterSchema}
                onSave={handleSchemaCapture}
              />
            </div>

            <DialogFooter className="justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>Pipeline stages</DialogTitle>
              <DialogDescription>
                Step 3 of 3 — Add the stages in your content pipeline.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-4">
              {stageNames.map((stageName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <Input
                    placeholder={`Stage ${index + 1}`}
                    value={stageName}
                    onChange={(e) => updateStage(index, e.target.value)}
                    className="flex-1"
                  />
                  {stageNames.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeStage(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={addStage}
              >
                Add stage
              </Button>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <DialogFooter className="justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
