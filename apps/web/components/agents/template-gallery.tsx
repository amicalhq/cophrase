"use client"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card"
import { InstallButton } from "./install-button"
import { CreateContentTypeDialog } from "./create-content-type-dialog"

interface Template {
  id: string
  name: string
  description: string
  format: string
  stages: { id: string; name: string; position: number }[]
}

interface TemplateGalleryProps {
  templates: Template[]
  installedSourceIds: string[]
  orgId: string
  projectId: string
}

export function TemplateGallery({
  templates,
  installedSourceIds,
  orgId,
  projectId,
}: TemplateGalleryProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          No templates available yet.
        </p>
        <CreateContentTypeDialog orgId={orgId} projectId={projectId} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const isInstalled = installedSourceIds.includes(template.id)
          const sortedStages = [...template.stages].sort(
            (a, b) => a.position - b.position
          )
          const pipeline = sortedStages.map((s) => s.name).join(" \u2192 ")

          return (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className="inline-flex w-fit rounded bg-muted px-2 py-0.5 text-xs">
                  {template.format.replace("_", " ")}
                </span>
                {pipeline && (
                  <p className="text-xs text-muted-foreground">{pipeline}</p>
                )}
              </CardContent>
              <CardFooter>
                <InstallButton
                  templateId={template.id}
                  projectId={projectId}
                  orgId={orgId}
                  isInstalled={isInstalled}
                />
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Don&apos;t see what you need?
        </span>
        <CreateContentTypeDialog orgId={orgId} projectId={projectId} />
      </div>
    </div>
  )
}
