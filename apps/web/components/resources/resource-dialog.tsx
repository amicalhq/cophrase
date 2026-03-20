"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { cn } from "@workspace/ui/lib/utils"
import type { ResourceType, ResourceCategory } from "@workspace/db"
import { ResourceEditor } from "./resource-editor"
import { FileDropzone } from "./file-dropzone"
import type { JSONContent } from "@tiptap/react"

const categoryOptions: { value: ResourceCategory; label: string }[] = [
  { value: "brand_voice", label: "Brand Voice" },
  { value: "product_features", label: "Product Features" },
  { value: "visual_identity", label: "Visual Identity" },
  { value: "documentation", label: "Documentation" },
  { value: "competitor_info", label: "Competitor Info" },
  { value: "target_audience", label: "Target Audience" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
]

const typeOptions: {
  value: ResourceType
  label: string
  description: string
}[] = [
  { value: "text", label: "Text", description: "Rich text content" },
  { value: "link", label: "Link", description: "URL reference" },
  { value: "file", label: "File", description: "Image or PDF" },
]

interface ResourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  projectId: string
  editResource?: {
    id: string
    title: string
    type: ResourceType
    category: ResourceCategory
    linkUrl?: string | null
    fileName?: string | null
    content?: JSONContent | null
  } | null
}

export function ResourceDialog({
  open,
  onOpenChange,
  orgId,
  projectId,
  editResource,
}: ResourceDialogProps) {
  const router = useRouter()
  const isEdit = !!editResource

  const [category, setCategory] = useState<ResourceCategory | "">("")
  const [type, setType] = useState<ResourceType | "">("")
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [editorContent, setEditorContent] = useState<JSONContent | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) {
      setCategory("")
      setType("")
      setTitle("")
      setLinkUrl("")
      setEditorContent(null)
      setSelectedFile(null)
      setError("")
      setLoading(false)
      setConfirmDelete(false)
      setDeleting(false)
      return
    }
    if (editResource) {
      setCategory(editResource.category)
      setType(editResource.type)
      setTitle(editResource.title)
      setLinkUrl(editResource.linkUrl ?? "")
      setEditorContent(editResource.content ?? null)
    }
  }, [open, editResource])

  async function handleDelete() {
    if (!editResource) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/resources/${editResource.id}?projectId=${projectId}&orgId=${orgId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to delete resource")
        setDeleting(false)
        return
      }
      setDeleting(false)
      onOpenChange(false)
      router.refresh()
    } catch {
      setError("Something went wrong")
      setDeleting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    if (!category) {
      setError("Category is required")
      return
    }
    if (!type) {
      setError("Type is required")
      return
    }
    if (!title.trim()) {
      setError("Title is required")
      return
    }
    if (type === "link" && !linkUrl.trim()) {
      setError("URL is required")
      return
    }
    if (type === "text" && !editorContent) {
      setError("Content is required")
      return
    }
    if (type === "file" && !isEdit && !selectedFile) {
      setError("File is required")
      return
    }

    setLoading(true)

    try {
      if (isEdit) {
        const patchBody: Record<string, unknown> = {
          projectId,
          orgId,
          title: title.trim(),
          category,
        }
        if (type === "link") patchBody.linkUrl = linkUrl
        if (type === "text") patchBody.content = editorContent
        if (type === "file" && selectedFile) {
          patchBody.fileName = selectedFile.name
          patchBody.fileMimeType = selectedFile.type
          patchBody.fileSize = selectedFile.size
        }

        const res = await fetch(
          `/api/resources/${editResource.id}?projectId=${projectId}&orgId=${orgId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          }
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? "Failed to update resource")
          setLoading(false)
          return
        }

        const result = await res.json()

        // Upload replacement file if needed
        if (result.uploadUrl && selectedFile) {
          const uploadRes = await fetch(result.uploadUrl, {
            method: "PUT",
            body: selectedFile,
            headers: { "Content-Type": selectedFile.type },
          })
          if (!uploadRes.ok) {
            setError("File upload failed")
            setLoading(false)
            return
          }
        }
      } else {
        const postBody: Record<string, unknown> = {
          projectId,
          orgId,
          title: title.trim(),
          type,
          category,
        }
        if (type === "link") postBody.linkUrl = linkUrl
        if (type === "text") postBody.content = editorContent
        if (type === "file" && selectedFile) {
          postBody.fileName = selectedFile.name
          postBody.fileMimeType = selectedFile.type
          postBody.fileSize = selectedFile.size
        }

        const res = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postBody),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? "Failed to create resource")
          setLoading(false)
          return
        }

        const result = await res.json()

        // Upload file to S3 via presigned URL
        if (result.uploadUrl && selectedFile) {
          const uploadRes = await fetch(result.uploadUrl, {
            method: "PUT",
            body: selectedFile,
            headers: { "Content-Type": selectedFile.type },
          })
          if (!uploadRes.ok) {
            // Roll back DB record
            await fetch(
              `/api/resources/${result.id}?projectId=${projectId}&orgId=${orgId}`,
              { method: "DELETE" }
            )
            setError("File upload failed. Please try again.")
            setLoading(false)
            return
          }
        }
      }

      setLoading(false)
      onOpenChange(false)
      router.refresh()
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit resource" : "Add resource"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this resource's details."
              : "Add a new resource to this project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Category */}
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ResourceCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type (create only) */}
            {!isEdit && (
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <div className="flex gap-3">
                  {typeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={cn(
                        "flex-1 rounded-lg border-2 p-4 text-center transition-colors",
                        type === opt.value
                          ? "border-foreground bg-accent"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            {(isEdit || type) && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="resource-title">Title</Label>
                <Input
                  id="resource-title"
                  placeholder="e.g. Brand Guidelines"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>
            )}

            {/* Content area — adapts by type */}
            {(type === "text" || (isEdit && editResource?.type === "text")) && (
              <div className="flex flex-col gap-2">
                <Label>Content</Label>
                <ResourceEditor
                  content={editorContent}
                  onChange={setEditorContent}
                />
              </div>
            )}

            {(type === "link" || (isEdit && editResource?.type === "link")) && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="resource-url">URL</Label>
                <Input
                  id="resource-url"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  type="url"
                />
              </div>
            )}

            {(type === "file" || (isEdit && editResource?.type === "file")) && (
              <div className="flex flex-col gap-2">
                <Label>File</Label>
                <FileDropzone
                  onFileSelect={setSelectedFile}
                  currentFileName={editResource?.fileName}
                />
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            {isEdit && !confirmDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
              >
                Delete
              </Button>
            )}
            {isEdit && confirmDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Confirm"}
              </Button>
            )}
            <Button type="submit" disabled={loading || deleting}>
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
