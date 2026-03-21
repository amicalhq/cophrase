import { router } from "@/lib/trpc/init"
import { projectsRouter } from "./projects"
import { providersRouter } from "./providers"
import { modelsRouter } from "./models"

export const appRouter = router({
  projects: projectsRouter,
  providers: providersRouter,
  models: modelsRouter,
})

export type AppRouter = typeof appRouter
