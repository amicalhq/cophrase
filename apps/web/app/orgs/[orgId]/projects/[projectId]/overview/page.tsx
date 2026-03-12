import { getProjectById } from "@/lib/data/projects"

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <h1 className="text-xl font-semibold">
        {project?.name ?? "Project"} Overview
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Project dashboard coming soon.
      </p>
    </main>
  )
}
