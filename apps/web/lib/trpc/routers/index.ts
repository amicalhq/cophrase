import { router } from "@/lib/trpc/init"
import { projectsRouter } from "./projects"
import { providersRouter } from "./providers"
import { modelsRouter } from "./models"
import { resourcesRouter } from "./resources"
import { contentRouter } from "./content"

export const appRouter = router({
  projects: projectsRouter,
  providers: providersRouter,
  models: modelsRouter,
  resources: resourcesRouter,
  content: contentRouter,
})

export type AppRouter = typeof appRouter
