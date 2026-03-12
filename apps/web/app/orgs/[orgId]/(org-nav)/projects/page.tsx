import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@workspace/auth"
import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import { getProjectsByOrg, isOrgMember } from "@/lib/data/projects"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) redirect("/orgs")

  const projects = await getProjectsByOrg(orgId)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/orgs/${orgId}/projects/${project.id}/overview`}
            className="border-border hover:bg-accent flex items-center gap-3 rounded-md border p-3 transition-colors"
          >
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarFallback className="rounded-md text-xs">
                {project.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{project.name}</p>
              {project.description && (
                <p className="text-muted-foreground text-xs">
                  {project.description}
                </p>
              )}
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No projects yet.
          </p>
        )}
      </div>
    </main>
  )
}
