import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import { getAgentById, updateAgent } from "@workspace/db/queries/agents"
import { isOrgMember } from "@/lib/data/projects"

export const PATCH = withResourceAuth(async (req, { session, params }) => {
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

  const body = (await req.json()) as {
    prompt?: string
    modelId?: string | null
    name?: string
    description?: string
  }

  const updated = await updateAgent(params.id!, body)
  if (!updated) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  return NextResponse.json(updated)
})
