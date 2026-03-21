import { router } from "@/lib/trpc/init"
import { projectsRouter } from "./projects"
import { providersRouter } from "./providers"
import { modelsRouter } from "./models"
import { resourcesRouter } from "./resources"

export const appRouter = router({
  projects: projectsRouter,
  providers: providersRouter,
  models: modelsRouter,
  resources: resourcesRouter,
})

export type AppRouter = typeof appRouter
