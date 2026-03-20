import { redirect } from "next/navigation"
import { getContentTypeWithStages } from "@/lib/data/content-types"
import { ContentTypeDetail } from "@/components/agents/content-type-detail"

export default async function ContentTypeDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; contentTypeId: string }>
}) {
  const { orgId, projectId, contentTypeId } = await params

  const ct = await getContentTypeWithStages(contentTypeId)
  if (!ct) {
    redirect(`/orgs/${orgId}/projects/${projectId}/agents`)
  }

  const contentType = {
    id: ct.id,
    name: ct.name,
    description: ct.description ?? "",
    format: ct.format,
    stages: ct.stages.map((s) => ({
      name: s.name,
      position: s.position,
      optional: s.optional,
      subAgents: s.subAgents.map((sa) => ({
        agentName: sa.agentName,
        agentDescription: sa.agentDescription,
      })),
    })),
  }

  return (
    <ContentTypeDetail
      contentType={contentType}
      orgId={orgId}
      projectId={projectId}
    />
  )
}
