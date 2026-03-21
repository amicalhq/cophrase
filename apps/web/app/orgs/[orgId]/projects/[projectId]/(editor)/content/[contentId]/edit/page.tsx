import { notFound } from "next/navigation"
import { getContentById } from "@/lib/data/content"
import { getModelsByOrg } from "@workspace/db/queries/models"
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

  const allModels = await getModelsByOrg(orgId)
  const languageModels = allModels
    .filter((m) => m.modelType === "language")
    .map((m) => ({
      id: m.id,
      modelId: m.modelId,
      providerType: m.providerType,
      isDefault: m.isDefault,
    }))

  return (
    <AIEditor
      contentTitle={content.title}
      currentStageName={content.currentStageName}
      orgId={orgId}
      projectId={projectId}
      contentId={contentId}
      contentFormat={content.contentFormat ?? "rich_text"}
      languageModels={languageModels}
    />
  )
}
