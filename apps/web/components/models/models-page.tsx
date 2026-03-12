"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { ProviderCard } from "./provider-card"
import { ModelsTable } from "./models-table"
import { AddProviderDialog } from "./add-provider-dialog"
import { AddModelsDialog } from "./add-models-dialog"
import { EditProviderDialog } from "./edit-provider-dialog"
import { useRouter } from "next/navigation"

interface Provider {
  id: string
  name: string
  providerType: string
  baseUrl: string | null
  modelCount: number
}

export interface ModelRow {
  id: string
  modelId: string
  modelType: string
  isDefault: boolean
  providerId: string
  providerName: string
  providerType: string
}

interface ModelsPageProps {
  orgId: string
  providers: Provider[]
  models: ModelRow[]
}

export function ModelsPage({ orgId, providers, models }: ModelsPageProps) {
  const router = useRouter()
  const [addProviderOpen, setAddProviderOpen] = useState(false)
  const [addModelsOpen, setAddModelsOpen] = useState(false)
  const [editProviderId, setEditProviderId] = useState<string | null>(null)

  const editProvider = providers.find((p) => p.id === editProviderId) ?? null

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Providers Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Providers</h2>
          <Button size="sm" onClick={() => setAddProviderOpen(true)}>
            Add provider
          </Button>
        </div>

        {providers.length === 0 ? (
          <div className="border-border rounded-md border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No providers configured</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Add a provider like OpenAI, Groq, or Vercel AI Gateway to get
              started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                name={provider.name}
                providerType={provider.providerType}
                modelCount={provider.modelCount}
                onClick={() => setEditProviderId(provider.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Models Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Models</h2>
          <Button
            size="sm"
            onClick={() => setAddModelsOpen(true)}
            disabled={providers.length === 0}
          >
            Add models
          </Button>
        </div>

        {providers.length === 0 ? (
          <div className="border-border rounded-md border py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Add a provider first to browse and enable models.
            </p>
          </div>
        ) : (
          <ModelsTable models={models} orgId={orgId} onRefresh={refresh} />
        )}
      </div>

      {/* Dialogs */}
      <AddProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        orgId={orgId}
        onSuccess={refresh}
      />

      <AddModelsDialog
        open={addModelsOpen}
        onOpenChange={setAddModelsOpen}
        orgId={orgId}
        providers={providers}
        enabledModels={models}
        onSuccess={refresh}
      />

      {editProvider && (
        <EditProviderDialog
          open={!!editProviderId}
          onOpenChange={(open) => {
            if (!open) setEditProviderId(null)
          }}
          orgId={orgId}
          provider={editProvider}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}
