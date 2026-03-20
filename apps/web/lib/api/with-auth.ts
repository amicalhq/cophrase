import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"

type Session = Awaited<ReturnType<typeof auth.api.getSession>> & {}

// Session-only auth (no org context needed)
export function withSessionAuth(
  handler: (
    req: NextRequest,
    ctx: { session: NonNullable<Session> }
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return handler(req, { session })
  }
}

// Auth with orgId from query or body
export function withOrgAuth(
  handler: (
    req: NextRequest,
    ctx: { session: NonNullable<Session>; orgId: string }
  ) => Promise<NextResponse>,
  opts: { orgIdFrom: "body" | "query" } = { orgIdFrom: "query" }
) {
  return async (req: NextRequest) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let orgId: string | null = null
    if (opts.orgIdFrom === "query") {
      orgId = req.nextUrl.searchParams.get("orgId")
    } else {
      // Clone request so body can be re-read by handler
      const cloned = req.clone()
      try {
        const body = await cloned.json()
        orgId = body?.orgId ?? null
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        )
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 })
    }

    const isMember = await isOrgMember(session.user.id, orgId)
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return handler(req, { session, orgId })
  }
}

// Auth with route params passed through (resource-level auth done by handler)
export function withResourceAuth(
  handler: (
    req: NextRequest,
    ctx: { session: NonNullable<Session>; params: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const params = await routeCtx.params
    return handler(req, { session, params })
  }
}
