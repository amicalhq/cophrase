import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) redirect("/orgs")

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <h1 className="text-xl font-semibold">Organization Settings</h1>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon.</p>
    </main>
  )
}
