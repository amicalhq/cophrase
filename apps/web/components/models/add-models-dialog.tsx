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
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import type { AvailableModel } from "@/lib/ai/types"

interface AddModelsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  providers: Array<{ id: string; name: string; providerType: string }>
  enabledModels: Array<{ id: string; modelId: string; providerId: string }>
  onSuccess: () => void
}

type ModelType = "language" | "embedding" | "image" | "video"

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  language: "Language",
  embedding: "Embedding",
  image: "Image",
  video: "Video",
}

interface CatalogModel extends AvailableModel {
  providerId: string
  providerName: string
}

export function AddModelsDialog({
  open,
  onOpenChange,
  orgId,
  providers,
  enabledModels,
  onSuccess,
}: AddModelsDialogProps) {
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState("")

  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<ModelType>("language")

  // selectedModels is a Set of "<providerId>:<modelId>"
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  // initialEnabled is the original enabled set for diff computation
  const [initialEnabled, setInitialEnabled] = useState<Set<string>>(new Set())
  // Reverse lookup: "providerId:modelId" → database row id (for deletions)
  const [enabledIdLookup, setEnabledIdLookup] = useState<Map<string, string>>(
    new Map()
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCatalogModels([])
      setFetchingModels(false)
      setFetchError("")
      setSearch("")
      setProviderFilter("all")
      setActiveTab("language")
      setSelectedModels(new Set())
      setInitialEnabled(new Set())
      setEnabledIdLookup(new Map())
      setLoading(false)
      setError("")
    }
  }, [open])

  // Fetch available models for all providers when dialog opens
  useEffect(() => {
    if (!open || providers.length === 0) return

    async function fetchAll() {
      setFetchingModels(true)
      setFetchError("")
      try {
        const results = await Promise.all(
          providers.map(async (provider) => {
            const res = await fetch(
              `/api/models/available?orgId=${orgId}&providerType=${provider.providerType}`
            )
            if (!res.ok) return []
            const models: AvailableModel[] = await res.json()
            return models.map(
              (m): CatalogModel => ({
                ...m,
                providerId: provider.id,
                providerName: provider.name,
              })
            )
          })
        )

        const combined = results.flat()
        setCatalogModels(combined)

        // Build initial enabled set from enabledModels prop
        const enabled = new Set<string>(
          enabledModels.map((em) => `${em.providerId}:${em.modelId}`)
        )
        setInitialEnabled(enabled)
        setSelectedModels(new Set(enabled))

        // Build reverse lookup: "providerId:modelId" → database row id
        const lookup = new Map<string, string>()
        for (const em of enabledModels) {
          lookup.set(`${em.providerId}:${em.modelId}`, em.id)
        }
        setEnabledIdLookup(lookup)

        // Set active tab to first tab that has models
        const types: ModelType[] = ["language", "embedding", "image", "video"]
        const firstType = types.find((t) => combined.some((m) => m.type === t))
        if (firstType) setActiveTab(firstType)
      } catch {
        setFetchError("Failed to fetch available models")
      } finally {
        setFetchingModels(false)
      }
    }

    fetchAll()
  }, [open, providers, orgId, enabledModels])

  function toggleModel(key: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const add: Array<{
        providerId: string
        modelId: string
        modelType: string
      }> = []
      const remove: string[] = []

      for (const model of catalogModels) {
        const key = `${model.providerId}:${model.id}`
        const wasEnabled = initialEnabled.has(key)
        const isNowEnabled = selectedModels.has(key)

        if (!wasEnabled && isNowEnabled) {
          add.push({
            providerId: model.providerId,
            modelId: model.id,
            modelType: model.type,
          })
        } else if (wasEnabled && !isNowEnabled) {
          const dbId = enabledIdLookup.get(key)
          if (dbId) remove.push(dbId)
        }
      }

      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, add, remove }),
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

  const filteredModels = (type: ModelType) =>
    catalogModels.filter((m) => {
      if (m.type !== type) return false
      if (providerFilter !== "all" && m.providerId !== providerFilter)
        return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        return (
          m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
        )
      }
      return true
    })

  const modelTypesWithCounts = (
    ["language", "embedding", "image", "video"] as ModelType[]
  ).filter((t) => catalogModels.some((m) => m.type === t))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add models</DialogTitle>
          <DialogDescription>
            Browse and enable models from your configured providers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 py-2">
            {fetchError && (
              <p className="text-sm text-destructive">{fetchError}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Search + provider filter */}
            <div className="flex gap-2">
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              {providers.length > 1 && (
                <Select
                  value={providerFilter}
                  onValueChange={setProviderFilter}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {fetchingModels ? (
              <p className="text-sm text-muted-foreground">Loading models...</p>
            ) : modelTypesWithCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No models available for your configured providers.
              </p>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as ModelType)}
              >
                <TabsList>
                  {modelTypesWithCounts.map((type) => (
                    <TabsTrigger key={type} value={type}>
                      {MODEL_TYPE_LABELS[type]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {modelTypesWithCounts.map((type) => {
                  const models = filteredModels(type)
                  return (
                    <TabsContent key={type} value={type}>
                      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
                        {models.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">
                            No models match your search.
                          </p>
                        ) : (
                          models.map((model) => {
                            const key = `${model.providerId}:${model.id}`
                            const isEnabled = initialEnabled.has(key)
                            const isSelected = selectedModels.has(key)
                            return (
                              <label
                                key={key}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted",
                                  isEnabled && "bg-accent"
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleModel(key)}
                                />
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="truncate text-xs font-medium">
                                    {model.id}
                                  </span>
                                  <Badge variant="outline" className="shrink-0">
                                    {MODEL_TYPE_LABELS[type as ModelType] ??
                                      type}
                                  </Badge>
                                </div>
                                {providers.length > 1 && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {model.providerName}
                                  </span>
                                )}
                              </label>
                            )
                          })
                        )}
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetchingModels}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
