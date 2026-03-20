import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getContentTypeById, forkContentType } from "@/lib/data/content-types"
import { isOrgMember } from "@/lib/data/projects"

export const POST = withResourceAuth(async (_req, { session, params }) => {
  const ct = await getContentTypeById(params.id!)
  if (!ct) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 })
  }
  if (!ct.organizationId || !ct.projectId) {
    return NextResponse.json({ error: "Cannot fork app-scoped content type" }, { status: 403 })
  }
  const isMember = await isOrgMember(session.user.id, ct.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const forked = await forkContentType({
    contentTypeId: params.id!,
    projectId: ct.projectId,
    orgId: ct.organizationId,
  })

  return NextResponse.json(forked, { status: 201 })
})
