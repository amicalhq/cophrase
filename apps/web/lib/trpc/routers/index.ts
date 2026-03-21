import { router } from "@/lib/trpc/init"
import { projectsRouter } from "./projects"
import { providersRouter } from "./providers"
import { modelsRouter } from "./models"
import { resourcesRouter } from "./resources"
import { contentRouter } from "./content"
import { contentTypesRouter } from "./content-types"
import { agentsRouter } from "./agents"

export const appRouter = router({
  projects: projectsRouter,
  providers: providersRouter,
  models: modelsRouter,
  resources: resourcesRouter,
  content: contentRouter,
  contentTypes: contentTypesRouter,
  agents: agentsRouter,
})

export type AppRouter = typeof appRouter
