import { notFound } from "next/navigation"
import { getContentById } from "@/lib/data/content"
import { AIEditor } from "@/components/editor/ai-editor"

// Auth + org membership are already checked by the parent layout at
// projects/[projectId]/layout.tsx — no need to re-check here.

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; contentId: string }>
}) {
  const { orgId, projectId, contentId } = await params

  const content = await getContentById(contentId, projectId)
  if (!content) notFound()

  return (
    <AIEditor
      contentTitle={content.title}
      orgId={orgId}
      projectId={projectId}
      contentId={contentId}
      contentType={content.type}
      contentStage={content.stage}
    />
  )
}
