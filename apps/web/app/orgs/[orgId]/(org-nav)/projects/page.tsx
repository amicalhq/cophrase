import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import { getProjectsByOrg } from "@/lib/data/projects"
import { CreateProjectDialog } from "@/components/create-project-dialog"

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const projects = await getProjectsByOrg(orgId)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <CreateProjectDialog orgId={orgId} />
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/orgs/${orgId}/projects/${project.id}/content`}
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
