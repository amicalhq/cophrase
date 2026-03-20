import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import {
  getContentTypeById,
  updateStage,
  deleteStage,
} from "@/lib/data/content-types"
import { isOrgMember } from "@/lib/data/projects"

async function authorizeViaContentType(
  contentTypeId: string,
  userId: string,
): Promise<
  | { authorized: true }
  | { authorized: false; response: NextResponse }
> {
  const ct = await getContentTypeById(contentTypeId)
  if (!ct) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Content type not found" },
        { status: 404 },
      ),
    }
  }
  if (!ct.organizationId) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Cannot modify app-scoped content type" },
        { status: 403 },
      ),
    }
  }
  const isMember = await isOrgMember(userId, ct.organizationId)
  if (!isMember) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { authorized: true }
}

export const PATCH = withResourceAuth(async (req, { session, params }) => {
  const auth = await authorizeViaContentType(params.id!, session.user.id)
  if (!auth.authorized) return auth.response

  const body = (await req.json()) as {
    name?: string
    optional?: boolean
  }

  const updated = await updateStage(params.stageId!, body)
  if (!updated) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 })
  }
  return NextResponse.json(updated)
})

export const DELETE = withResourceAuth(async (_req, { session, params }) => {
  const auth = await authorizeViaContentType(params.id!, session.user.id)
  if (!auth.authorized) return auth.response

  const deleted = await deleteStage(params.stageId!)
  if (!deleted) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 })
  }
  return NextResponse.json(deleted)
})
