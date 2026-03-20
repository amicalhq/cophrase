import Link from "next/link"
import { getContentByProject } from "@/lib/data/content"
import { getContentTypesByProject } from "@/lib/data/content-types"
import { ContentTable } from "@/components/content/content-table"
import { CreateContentDialog } from "@/components/content/create-content-dialog"
import type { ContentRow } from "@/components/content/columns"

export type ContentTypeOption = {
  id: string
  name: string
  description: string
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>
}) {
  const { orgId, projectId } = await params
  const [rawContent, rawContentTypes] = await Promise.all([
    getContentByProject(projectId),
    getContentTypesByProject(projectId),
  ])

  const content: ContentRow[] = rawContent.map((c) => ({
    id: c.id,
    title: c.title,
    contentTypeName: c.contentTypeName,
    currentStageName: c.currentStageName,
    creatorName: c.creatorName,
    updatedAt: c.updatedAt.toISOString(),
  }))

  const contentTypes: ContentTypeOption[] = rawContentTypes.map((ct) => ({
    id: ct.id,
    name: ct.name,
    description: ct.description ?? "",
  }))

  const hasContentTypes = contentTypes.length > 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Content</h1>
        {hasContentTypes && (
          <CreateContentDialog
            orgId={orgId}
            projectId={projectId}
            contentTypes={contentTypes}
          />
        )}
      </div>
      {hasContentTypes ? (
        <ContentTable
          data={content}
          orgId={orgId}
          projectId={projectId}
          contentTypes={contentTypes}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground text-sm">
            No content types configured.{" "}
            <Link
              href={`/orgs/${orgId}/projects/${projectId}/agents`}
              className="text-foreground underline underline-offset-4"
            >
              Visit the Agents tab
            </Link>{" "}
            to install one.
          </p>
        </div>
      )}
    </main>
  )
}
