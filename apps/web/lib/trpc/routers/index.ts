import { router } from "@/lib/trpc/init"
import { projectsRouter } from "./projects"
import { providersRouter } from "./providers"

export const appRouter = router({
  projects: projectsRouter,
  providers: providersRouter,
})

export type AppRouter = typeof appRouter
