import { getResourcesByProject } from "@/lib/data/resources"
import { ResourcesPageClient } from "@/components/resources/resources-page-client"

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const rawResources = await getResourcesByProject(projectId, orgId)

  const resources = rawResources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    category: r.category,
    linkUrl: r.linkUrl,
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileMimeType: r.fileMimeType,
    updatedAt: r.updatedAt.toISOString(),
  }))

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <ResourcesPageClient
        resources={resources}
        orgId={orgId}
        projectId={projectId}
      />
    </main>
  )
}
