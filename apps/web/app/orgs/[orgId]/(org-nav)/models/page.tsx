import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { getProvidersByOrg } from "@/lib/data/providers"
import { getModelsByOrg } from "@/lib/data/models"
import { ModelsPage } from "@/components/models/models-page"

export default async function ModelsPageRoute({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) redirect("/orgs")

  const [providers, models] = await Promise.all([
    getProvidersByOrg(orgId),
    getModelsByOrg(orgId),
  ])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <ModelsPage orgId={orgId} providers={providers} models={models} />
    </main>
  )
}
