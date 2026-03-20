"use client"

import Link from "next/link"

interface InstalledContentType {
  id: string
  name: string
  format: string
  stages: { id: string; name: string; position: number }[]
}

interface InstalledContentTypesProps {
  contentTypes: InstalledContentType[]
  orgId: string
  projectId: string
}

export function InstalledContentTypes({
  contentTypes,
  orgId,
  projectId,
}: InstalledContentTypesProps) {
  if (contentTypes.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {contentTypes.map((ct) => {
        const sortedStages = [...ct.stages].sort(
          (a, b) => a.position - b.position
        )
        const pipeline = sortedStages.map((s) => s.name).join(" \u2192 ")

        return (
          <Link
            key={ct.id}
            href={`/orgs/${orgId}/projects/${projectId}/agents/${ct.id}`}
            className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{ct.name}</span>
              {pipeline && (
                <span className="text-xs text-muted-foreground">
                  {pipeline}
                </span>
              )}
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              {ct.format.replace("_", " ")}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
