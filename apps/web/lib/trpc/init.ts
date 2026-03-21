import { initTRPC, TRPCError } from "@trpc/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { z } from "zod"

// Context — created fresh per request
export async function createContext() {
  const session = await auth.api.getSession({ headers: await headers() })
  return { session }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

// Authenticated procedure — rejects if no session
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { session: ctx.session } })
})

// Org-scoped procedure — checks session + org membership
// Input must include `orgId: string`
export const orgProcedure = authedProcedure
  .input(z.object({ orgId: z.string().min(1) }))
  .use(async ({ ctx, input, next }) => {
    const isMember = await isOrgMember(ctx.session.user.id, input.orgId)
    if (!isMember) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }
    return next({ ctx: { ...ctx, orgId: input.orgId } })
  })
