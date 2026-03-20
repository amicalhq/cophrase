import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getContentTypeById, reorderStages } from "@/lib/data/content-types"
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

  const body = (await req.json()) as { stageIds?: string[] }

  if (!body.stageIds || !Array.isArray(body.stageIds)) {
    return NextResponse.json(
      { error: "stageIds array is required" },
      { status: 400 },
    )
  }

  const result = await reorderStages(params.id!, body.stageIds)
  if ("error" in result) {
    return NextResponse.json(
      { error: "Stage IDs do not match existing stages" },
      { status: 400 },
    )
  }
  return NextResponse.json(result)
})
