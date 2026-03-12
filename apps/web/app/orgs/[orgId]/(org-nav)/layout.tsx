import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { OrgNavLayoutClient } from "./org-nav-layout-client"

export default async function OrgNavLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) redirect("/orgs")

  return (
    <OrgNavLayoutClient orgId={orgId}>{children}</OrgNavLayoutClient>
  )
}
