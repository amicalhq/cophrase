import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { getContentById } from "@/lib/data/content"
import { AIEditor } from "@/components/editor/ai-editor"

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; contentId: string }>
}) {
  const { orgId, projectId, contentId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const content = await getContentById(contentId, projectId)
  if (!content) notFound()

  return (
    <AIEditor
      contentTitle={content.title}
      backHref={`/orgs/${orgId}/projects/${projectId}/content`}
    />
  )
}
