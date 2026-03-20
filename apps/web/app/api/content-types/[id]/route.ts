import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import {
  getContentTypeById,
  getContentTypeWithStages,
  updateContentType,
  deleteContentTypeIfUnused,
} from "@/lib/data/content-types"
import { isOrgMember } from "@/lib/data/projects"

async function authorizeContentType(
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

export const GET = withResourceAuth(async (_req, { session, params }) => {
  const auth = await authorizeContentType(params.id!, session.user.id)
  if (!auth.authorized) return auth.response

  const ct = await getContentTypeWithStages(params.id!)
  if (!ct) {
    return NextResponse.json(
      { error: "Content type not found" },
      { status: 404 },
    )
  }
  return NextResponse.json(ct)
})

export const PATCH = withResourceAuth(async (req, { session, params }) => {
  const auth = await authorizeContentType(params.id!, session.user.id)
  if (!auth.authorized) return auth.response

  const body = (await req.json()) as {
    name?: string
    description?: string
    frontmatterSchema?: Record<string, unknown>
  }

  const updated = await updateContentType(params.id!, body)
  if (!updated) {
    return NextResponse.json(
      { error: "Content type not found" },
      { status: 404 },
    )
  }
  return NextResponse.json(updated)
})

export const DELETE = withResourceAuth(async (_req, { session, params }) => {
  const auth = await authorizeContentType(params.id!, session.user.id)
  if (!auth.authorized) return auth.response

  const result = await deleteContentTypeIfUnused(params.id!)
  if (result && "error" in result && result.error === "in_use") {
    return NextResponse.json(
      { error: "Content type is in use and cannot be deleted" },
      { status: 409 },
    )
  }
  return NextResponse.json(result)
})
