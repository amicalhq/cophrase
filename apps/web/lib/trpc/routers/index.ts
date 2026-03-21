import { router } from "@/lib/trpc/init"

export const appRouter = router({})

export type AppRouter = typeof appRouter
