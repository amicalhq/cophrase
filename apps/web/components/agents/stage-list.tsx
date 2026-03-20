"use client"

import { useState } from "react"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui/components/collapsible"
import { AgentPromptEditor } from "./agent-prompt-editor"
import { AgentModelPicker } from "./agent-model-picker"
import { AgentToolsEditor } from "./agent-tools-editor"

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

interface StageListProps {
  stages: Stage[]
  models: ModelOption[]
}

function SubAgentItem({
  subAgent,
  models,
}: {
  subAgent: SubAgent
  models: ModelOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-start gap-1 text-left">
        <span className="mt-0.5 text-xs text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
        <span className="text-xs">
          <span className="font-medium">{subAgent.agentName}</span>
          {subAgent.agentDescription && (
            <span className="text-muted-foreground">
              {" \u2014 "}
              {subAgent.agentDescription}
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 flex flex-col gap-4 rounded-lg border p-4">
          <AgentPromptEditor
            agentId={subAgent.agentId}
            label="Prompt"
            initialPrompt={subAgent.prompt}
          />
          <AgentModelPicker
            agentId={subAgent.agentId}
            currentModelId={subAgent.modelId}
            models={models}
          />
          <AgentToolsEditor
            agentId={subAgent.agentId}
            initialTools={subAgent.tools}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function StageList({ stages, models }: StageListProps) {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)

  if (sortedStages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No stages configured yet.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-4">
      {sortedStages.map((stage) => (
        <li key={stage.position} className="rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {stage.position}
            </span>
            <span className="text-sm font-medium">{stage.name}</span>
            {stage.optional && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                optional
              </span>
            )}
          </div>
          {stage.subAgents.length > 0 && (
            <ul className="mt-2 ml-8 flex flex-col gap-2">
              {stage.subAgents.map((sa) => (
                <li key={sa.agentId}>
                  <SubAgentItem subAgent={sa} models={models} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
