import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getContentTypeById, addStage } from "@/lib/data/content-types"
import { isOrgMember } from "@/lib/data/projects"

export const POST = withResourceAuth(async (req, { session, params }) => {
  const ct = await getContentTypeById(params.id!)
  if (!ct) {
    return NextResponse.json(
      { error: "Content type not found" },
      { status: 404 },
    )
  }
  if (!ct.organizationId) {
    return NextResponse.json(
      { error: "Cannot modify app-scoped content type" },
      { status: 403 },
    )
  }
  const isMember = await isOrgMember(session.user.id, ct.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json()) as {
    name?: string
    position?: number
    optional?: boolean
  }

  if (!body.name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 },
    )
  }

  const stage = await addStage({
    contentTypeId: params.id!,
    name: body.name,
    position: body.position,
    optional: body.optional,
  })
  return NextResponse.json(stage, { status: 201 })
})
