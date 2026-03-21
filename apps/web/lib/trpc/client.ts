import {
  createTRPCReact,
  type CreateTRPCReact,
} from "@trpc/react-query"
import type { AppRouter } from "@/lib/trpc/routers"

export const trpc: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>()
