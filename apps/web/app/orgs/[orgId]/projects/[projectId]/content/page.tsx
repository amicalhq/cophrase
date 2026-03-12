import { getContentByProject } from "@/lib/data/content"
import { ContentTable } from "@/components/content/content-table"
import { CreateContentDialog } from "@/components/content/create-content-dialog"
import type { ContentRow } from "@/components/content/columns"

export default async function ContentPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const rawContent = await getContentByProject(projectId)

  const content: ContentRow[] = rawContent.map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    stage: c.stage,
    creatorName: c.creatorName,
    updatedAt: c.updatedAt.toISOString(),
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Content</h1>
        <CreateContentDialog orgId={orgId} projectId={projectId} />
      </div>
      <ContentTable data={content} />
    </main>
  )
}
