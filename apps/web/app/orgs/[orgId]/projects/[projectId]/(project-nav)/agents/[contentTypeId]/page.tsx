import { redirect } from "next/navigation"
import { getContentTypeWithStages, getHarnessConfig } from "@/lib/data/content-types"
import { getModelsByOrg } from "@workspace/db/queries/models"
import { ContentTypeDetail } from "@/components/agents/content-type-detail"

export default async function ContentTypeDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; contentTypeId: string }>
}) {
  const { orgId, projectId, contentTypeId } = await params

  const [ct, harnessConfig] = await Promise.all([
    getContentTypeWithStages(contentTypeId),
    getHarnessConfig(contentTypeId),
  ])

  if (!ct) {
    redirect(`/orgs/${orgId}/projects/${projectId}/agents`)
  }

  const models = ct.organizationId
    ? (await getModelsByOrg(ct.organizationId)).map((m) => ({
        id: m.id,
        name: m.modelId,
        provider: m.providerName,
      }))
    : []

  const contentType = {
    id: ct.id,
    name: ct.name,
    description: ct.description ?? "",
    format: ct.format,
    frontmatterSchema: ct.frontmatterSchema,
    contentAgent: harnessConfig
      ? {
          id: harnessConfig.contentAgent.id,
          prompt: harnessConfig.contentAgent.prompt,
          modelId: harnessConfig.contentAgent.modelId,
        }
      : undefined,
    stages: (harnessConfig ? harnessConfig.stages : ct.stages).map((s) => {
      if (harnessConfig) {
        const hs = s as (typeof harnessConfig.stages)[number]
        return {
          name: hs.name,
          position: hs.position,
          optional: hs.optional,
          subAgents: hs.subAgents.map((sa) => ({
            agentId: sa.agentId,
            agentName: sa.name,
            agentDescription: null,
            prompt: sa.prompt,
            modelId: sa.modelId,
            tools: sa.tools,
          })),
        }
      }
      const cs = s as (typeof ct.stages)[number]
      return {
        name: cs.name,
        position: cs.position,
        optional: cs.optional,
        subAgents: cs.subAgents.map((sa) => ({
          agentId: sa.agentId,
          agentName: sa.agentName,
          agentDescription: sa.agentDescription,
          prompt: "",
          modelId: null,
          tools: [],
        })),
      }
    }),
  }

  return (
    <ContentTypeDetail
      contentType={contentType}
      orgId={orgId}
      projectId={projectId}
      models={models}
    />
  )
}
