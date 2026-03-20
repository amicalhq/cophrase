import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getContentTypeById, unbindSubAgent } from "@/lib/data/content-types"
import { isOrgMember } from "@/lib/data/projects"

export const DELETE = withResourceAuth(async (_req, { session, params }) => {
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

  const deleted = await unbindSubAgent(params.subAgentId!)
  if (!deleted) {
    return NextResponse.json(
      { error: "Sub-agent not found" },
      { status: 404 },
    )
  }
  return NextResponse.json(deleted)
})
