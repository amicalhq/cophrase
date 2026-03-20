"use client"

interface SubAgent {
  agentName: string
  agentDescription: string | null
}

interface Stage {
  name: string
  position: number
  optional: boolean
  subAgents: SubAgent[]
}

interface StageListProps {
  stages: Stage[]
}

export function StageList({ stages }: StageListProps) {
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
            <ul className="mt-2 ml-8 flex flex-col gap-1">
              {stage.subAgents.map((sa) => (
                <li key={sa.agentName} className="text-xs">
                  <span className="font-medium">{sa.agentName}</span>
                  {sa.agentDescription && (
                    <span className="text-muted-foreground">
                      {" \u2014 "}
                      {sa.agentDescription}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
