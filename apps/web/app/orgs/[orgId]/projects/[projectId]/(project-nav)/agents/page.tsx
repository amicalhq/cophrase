import {
  getAppContentTypes,
  getContentTypesByProject,
  getStagesByContentType,
} from "@/lib/data/content-types"
import { TemplateGallery } from "@/components/agents/template-gallery"
import { InstalledContentTypes } from "@/components/agents/installed-content-types"

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params

  const [appTemplates, installedTypes] = await Promise.all([
    getAppContentTypes(),
    getContentTypesByProject(projectId),
  ])

  // Fetch stages for each template so we can show the pipeline preview
  const templatesWithStages = await Promise.all(
    appTemplates.map(async (t) => {
      const stages = await getStagesByContentType(t.id)
      return {
        id: t.id,
        name: t.name,
        description: t.description ?? "",
        format: t.format,
        stages: stages.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        })),
      }
    })
  )

  const installedSourceIds = installedTypes
    .map((t) => t.sourceId)
    .filter((id): id is string => id !== null)

  const installedForList = installedTypes.map((ct) => ({
    id: ct.id,
    name: ct.name,
    format: ct.format,
    stages: ct.stages.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
    })),
  }))

  const hasInstalled = installedTypes.length > 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agents</h1>
      </div>

      {hasInstalled ? (
        <>
          <div className="mb-8">
            <InstalledContentTypes
              contentTypes={installedForList}
              orgId={orgId}
              projectId={projectId}
            />
          </div>

          <div>
            <h2 className="mb-4 text-lg font-medium">
              Add from templates
            </h2>
            <TemplateGallery
              templates={templatesWithStages}
              installedSourceIds={installedSourceIds}
              orgId={orgId}
              projectId={projectId}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            Install an agent template to get started. Each template defines a
            content type with a pipeline of stages and AI sub-agents.
          </p>
          <TemplateGallery
            templates={templatesWithStages}
            installedSourceIds={installedSourceIds}
            orgId={orgId}
            projectId={projectId}
          />
        </>
      )}
    </main>
  )
}
