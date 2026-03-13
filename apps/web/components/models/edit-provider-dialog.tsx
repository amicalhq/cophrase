"use client"

import { useState, useEffect } from "react"
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
import { Badge } from "@workspace/ui/components/badge"
import { ConnectionTestBanner } from "./connection-test-banner"

interface EditProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  provider: {
    id: string
    name: string
    providerType: string
    baseUrl: string | null
    modelCount: number
  }
  onSuccess: () => void
}

function providerTypeLabel(providerType: string): string {
  if (providerType === "ai-gateway") return "Vercel AI Gateway"
  return providerType.charAt(0).toUpperCase() + providerType.slice(1)
}

const BASE_URL_PROVIDER_TYPES = ["openai", "ai-gateway"]

export function EditProviderDialog({
  open,
  onOpenChange,
  orgId,
  provider,
  onSuccess,
}: EditProviderDialogProps) {
  const [name, setName] = useState(provider.name)
  const [apiKey, setApiKey] = useState("")
  const [baseURL, setBaseURL] = useState(provider.baseUrl ?? "")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  // Connection test state
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testError, setTestError] = useState("")

  const showBaseUrl = BASE_URL_PROVIDER_TYPES.includes(provider.providerType)

  // Reset state when dialog opens/closes or provider changes
  useEffect(() => {
    if (open) {
      setName(provider.name)
      setApiKey("")
      setBaseURL(provider.baseUrl ?? "")
      setLoading(false)
      setError("")
      setShowDeleteConfirm(false)
      setDeleteLoading(false)
      setDeleteError("")
      setTestStatus("idle")
      setTestError("")
    }
  }, [open, provider])

  async function handleTestConnection() {
    setTestStatus("testing")
    setTestError("")
    try {
      const body: Record<string, string | undefined> = { orgId, providerId: provider.id }
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim()
      }
      if (baseURL.trim()) {
        body.baseURL = baseURL.trim()
      }

      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setTestStatus("success")
      } else {
        setTestStatus("error")
        setTestError(data.error ?? "Connection failed")
      }
    } catch {
      setTestStatus("error")
      setTestError("Something went wrong")
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError("")

    try {
      const body: Record<string, string | null> = {
        orgId,
        name: name.trim(),
      }
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim()
      }
      if (showBaseUrl) {
        body.baseURL = baseURL.trim() || null
      }

      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to save changes")
        setLoading(false)
        return
      }

      onOpenChange(false)
      onSuccess()
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true)
    setDeleteError("")

    try {
      const res = await fetch(
        `/api/providers/${provider.id}?orgId=${orgId}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error ?? "Failed to delete provider")
        setDeleteLoading(false)
        return
      }

      onOpenChange(false)
      onSuccess()
    } catch {
      setDeleteError("Something went wrong")
      setDeleteLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit provider
            <Badge variant="secondary">{providerTypeLabel(provider.providerType)}</Badge>
          </DialogTitle>
          <DialogDescription>
            Update provider settings or remove this provider.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave}>
          <div className="flex flex-col gap-4 py-2">
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            {/* Name field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-provider-name">Name</Label>
              <Input
                id="edit-provider-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* API Key field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-provider-api-key">API Key</Label>
              <Input
                id="edit-provider-api-key"
                type="password"
                placeholder="Leave blank to keep current key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestStatus("idle")
                  setTestError("")
                }}
                autoComplete="off"
              />
            </div>

            {/* Base URL field (optional, only for certain providers) */}
            {showBaseUrl && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-provider-base-url">
                  Base URL{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="edit-provider-base-url"
                  placeholder="https://api.openai.com/v1"
                  value={baseURL}
                  onChange={(e) => {
                    setBaseURL(e.target.value)
                    setTestStatus("idle")
                    setTestError("")
                  }}
                />
              </div>
            )}

            <ConnectionTestBanner status={testStatus} error={testError} />
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setShowDeleteConfirm(true)
                  setDeleteError("")
                }}
                disabled={deleteLoading}
              >
                Delete provider
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testStatus === "testing"}
                  onClick={handleTestConnection}
                >
                  {testStatus === "testing" ? "Testing..." : "Test connection"}
                </Button>
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>

        {/* Inline delete confirmation */}
        {showDeleteConfirm && (
          <div className="border-border mt-2 rounded-md border p-3">
            {deleteError && (
              <p className="text-destructive mb-2 text-sm">{deleteError}</p>
            )}
            <p className="text-sm">
              This will remove all its models. Are you sure?
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Confirm delete"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteError("")
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
