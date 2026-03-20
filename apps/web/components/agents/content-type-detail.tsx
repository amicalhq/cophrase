"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { StageList } from "./stage-list"
import { AgentPromptEditor } from "./agent-prompt-editor"
import { AgentModelPicker } from "./agent-model-picker"
import { ForkButton } from "./fork-button"

interface ModelOption {
  id: string
  name: string
  provider: string
}

interface AgentTool {
  id: string
  type: string
  referenceId: string
  required: boolean
}

interface SubAgent {
  agentId: string
  agentName: string
  agentDescription: string | null
  prompt: string
  modelId: string | null
  tools: AgentTool[]
}

interface Stage {
  name: string
  position: number
  optional: boolean
  subAgents: SubAgent[]
}

interface ContentAgent {
  id: string
  prompt: string
  modelId: string | null
}

interface ContentTypeDetailProps {
  contentType: {
    id: string
    name: string
    description: string
    format: string
    contentAgent?: ContentAgent
    stages: Stage[]
  }
  orgId: string
  projectId: string
  models: ModelOption[]
}

export function ContentTypeDetail({
  contentType,
  orgId,
  projectId,
  models,
}: ContentTypeDetailProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/content-types/${contentType.id}`, {
        method: "DELETE",
      })

      if (res.status === 409) {
        setError("Cannot delete — content pieces still reference this type.")
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to delete")
        return
      }

      router.push(`/orgs/${orgId}/projects/${projectId}/agents`)
    } catch {
      setError("Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  const agentsHref = `/orgs/${orgId}/projects/${projectId}/agents`

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <Link
          href={agentsHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to agents
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{contentType.name}</h1>
            {contentType.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {contentType.description}
              </p>
            )}
            <span className="mt-2 inline-flex rounded bg-muted px-2 py-0.5 text-xs">
              {contentType.format.replace("_", " ")}
            </span>
          </div>
          <ForkButton
            contentTypeId={contentType.id}
            orgId={orgId}
            projectId={projectId}
          />
        </div>
      </div>

      {contentType.contentAgent && (
        <div className="mb-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">Content Agent</h2>
          <div className="flex flex-col gap-4">
            <AgentPromptEditor
              agentId={contentType.contentAgent.id}
              label="Orchestration prompt"
              initialPrompt={contentType.contentAgent.prompt}
            />
            <AgentModelPicker
              agentId={contentType.contentAgent.id}
              currentModelId={contentType.contentAgent.modelId}
              models={models}
            />
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-medium">Pipeline Stages</h2>
        <StageList stages={contentType.stages} models={models} />
      </div>

      <div className="rounded-lg border border-destructive/20 p-4">
        <h2 className="mb-2 text-sm font-medium text-destructive">
          Danger zone
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Permanently delete this content type and all its stages. This action
          cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? "Deleting..." : "Delete content type"}
        </Button>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </main>
  )
}
