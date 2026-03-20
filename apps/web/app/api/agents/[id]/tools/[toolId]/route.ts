import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getAgentById, removeAgentTool } from "@workspace/db/queries/agents"
import { isOrgMember } from "@/lib/data/projects"

export const DELETE = withResourceAuth(async (_req, { session, params }) => {
  const agent = await getAgentById(params.id!)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (!agent.organizationId) {
    return NextResponse.json(
      { error: "Cannot modify app-scoped agent" },
      { status: 403 },
    )
  }
  const isMember = await isOrgMember(session.user.id, agent.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const deleted = await removeAgentTool(params.toolId!)
  if (!deleted) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 })
  }
  return NextResponse.json(deleted)
})
