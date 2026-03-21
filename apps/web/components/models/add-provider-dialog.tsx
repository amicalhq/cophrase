"use client"

import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import type { AvailableModel } from "@/lib/ai/types"
import {
  ConnectionTestBanner,
  type ConnectionTestStatus,
} from "./connection-test-banner"

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  onSuccess: () => void
}

type ProviderType = "openai" | "groq" | "ai-gateway"

interface ProviderOption {
  type: ProviderType
  name: string
  logoKey: string
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { type: "openai", name: "OpenAI", logoKey: "openai" },
  { type: "groq", name: "Groq", logoKey: "groq" },
  { type: "ai-gateway", name: "Vercel AI Gateway", logoKey: "vercel" },
]

type ModelType = "language" | "embedding" | "image" | "video"

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  language: "Language",
  embedding: "Embedding",
  image: "Image",
  video: "Video",
}

export function AddProviderDialog({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: AddProviderDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 form state
  const [providerType, setProviderType] = useState<ProviderType | null>(null)
  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [baseURL, setBaseURL] = useState("")

  // Step 2 state
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState("")
  const [activeTab, setActiveTab] = useState<ModelType>("language")

  // Submit state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Connection test state
  const [testStatus, setTestStatus] = useState<ConnectionTestStatus>("idle")
  const [testError, setTestError] = useState("")

  const testMutation = trpc.providers.test.useMutation()
  const createMutation = trpc.providers.create.useMutation()

  // Reset all state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setProviderType(null)
      setName("")
      setApiKey("")
      setBaseURL("")
      setAvailableModels([])
      setSelectedModels(new Set())
      setFetchingModels(false)
      setFetchError("")
      setActiveTab("language")
      setLoading(false)
      setError("")
      setTestStatus("idle")
      setTestError("")
    }
  }, [open])

  async function runConnectionTest(): Promise<boolean> {
    setTestStatus("testing")
    setTestError("")
    try {
      const data = await testMutation.mutateAsync({
        orgId,
        providerType: providerType ?? undefined,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined,
      })
      if (data.success) {
        setTestStatus("success")
        return true
      } else {
        setTestStatus("error")
        setTestError(data.error ?? "Connection failed")
        return false
      }
    } catch {
      setTestStatus("error")
      setTestError("Something went wrong")
      return false
    }
  }

  async function handleNextStep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!providerType || !name.trim() || !apiKey.trim()) return

    // Test connection first
    const connected = await runConnectionTest()
    if (!connected) return

    setFetchingModels(true)
    setFetchError("")
    try {
      const res = await fetch(
        `/api/models/available?orgId=${orgId}&providerType=${providerType}`
      )
      if (!res.ok) {
        const data = await res.json()
        setFetchError(data.error ?? "Failed to fetch available models")
        setFetchingModels(false)
        return
      }
      const models: AvailableModel[] = await res.json()
      setAvailableModels(models)

      // Auto-check the latest model of each type
      const autoSelected = new Set<string>()
      const types: ModelType[] = ["language", "embedding", "image", "video"]
      for (const type of types) {
        const modelsOfType = models.filter((m) => m.type === type)
        const first = modelsOfType[0]
        if (first) {
          autoSelected.add(first.id)
        }
      }
      setSelectedModels(autoSelected)

      // Set the active tab to the first type that has models
      const firstAvailableType = types.find((t) =>
        models.some((m) => m.type === t)
      )
      if (firstAvailableType) setActiveTab(firstAvailableType)

      setStep(2)
    } catch {
      setFetchError("Something went wrong fetching models")
    } finally {
      setFetchingModels(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!providerType) return

    setLoading(true)
    setError("")

    const models = availableModels
      .filter((m) => selectedModels.has(m.id))
      .map((m) => ({ modelId: m.id, modelType: m.type }))

    createMutation.mutate(
      {
        orgId,
        name: name.trim(),
        providerType,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined,
        models,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          onSuccess()
        },
        onError: (err) => {
          setError(err.message ?? "Failed to add provider")
          setLoading(false)
        },
      }
    )
  }

  function toggleModel(modelId: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  const modelsByType = (type: ModelType) =>
    availableModels.filter((m) => m.type === type)

  const modelTypesWithCounts = (
    ["language", "embedding", "image", "video"] as ModelType[]
  ).filter((t) => modelsByType(t).length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Add provider" : "Enable models"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Connect an AI provider to your organization."
              : "Choose which models to enable for this provider."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handleNextStep}>
            <div className="flex flex-col gap-4 py-2">
              {fetchError && (
                <p className="text-sm text-destructive">{fetchError}</p>
              )}

              {/* Provider type selector */}
              <div className="flex flex-col gap-2">
                <Label>Provider</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDER_OPTIONS.map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => {
                        setProviderType(option.type)
                        setTestStatus("idle")
                        setTestError("")
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted",
                        providerType === option.type
                          ? "border-2 border-primary"
                          : "border-border"
                      )}
                    >
                      <img
                        src={`https://models.dev/logos/${option.logoKey}.svg`}
                        alt={option.name}
                        className="h-8 w-8 object-contain dark:invert"
                      />
                      <span className="text-xs font-medium">{option.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider-name">Name</Label>
                <Input
                  id="provider-name"
                  placeholder="My OpenAI provider"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* API Key field */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider-api-key">API Key</Label>
                <Input
                  id="provider-api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestStatus("idle")
                    setTestError("")
                  }}
                  autoComplete="off"
                  required
                />
              </div>

              {/* Base URL field (optional) */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider-base-url">
                  Base URL{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="provider-base-url"
                  placeholder="https://api.openai.com/v1"
                  value={baseURL}
                  onChange={(e) => {
                    setBaseURL(e.target.value)
                    setTestStatus("idle")
                    setTestError("")
                  }}
                />
              </div>

              <ConnectionTestBanner status={testStatus} error={testError} />
            </div>

            <DialogFooter className="pt-4">
              <div className="flex w-full items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    testStatus === "testing" ||
                    fetchingModels ||
                    !providerType ||
                    !apiKey.trim()
                  }
                  onClick={runConnectionTest}
                >
                  Test connection
                </Button>
                <Button
                  type="submit"
                  disabled={
                    testStatus === "testing" ||
                    fetchingModels ||
                    !providerType ||
                    !name.trim() ||
                    !apiKey.trim()
                  }
                >
                  {testStatus === "testing"
                    ? "Testing connection..."
                    : fetchingModels
                      ? "Fetching models..."
                      : "Next: Select models →"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 py-2">
              {error && <p className="text-sm text-destructive">{error}</p>}

              {modelTypesWithCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No models available for this provider.
                </p>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as ModelType)}
                >
                  <TabsList>
                    {modelTypesWithCounts.map((type) => (
                      <TabsTrigger key={type} value={type}>
                        {MODEL_TYPE_LABELS[type]} ({modelsByType(type).length})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {modelTypesWithCounts.map((type) => (
                    <TabsContent key={type} value={type}>
                      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
                        {modelsByType(type).map((model, index) => (
                          <label
                            key={model.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                          >
                            <Checkbox
                              checked={selectedModels.has(model.id)}
                              onCheckedChange={() => toggleModel(model.id)}
                            />
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-xs font-medium">
                                {model.name}
                              </span>
                              {index === 0 && (
                                <Badge variant="secondary" className="shrink-0">
                                  Latest
                                </Badge>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1)
                  setError("")
                }}
              >
                ← Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add provider & models"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
