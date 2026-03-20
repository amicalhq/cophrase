import { NextResponse } from "next/server"
import { withResourceAuth } from "@/lib/api/with-auth"
import {
  getAgentById,
  getAgentTools,
  addAgentTool,
} from "@workspace/db/queries/agents"
import { isOrgMember } from "@/lib/data/projects"

export const GET = withResourceAuth(async (_req, { session, params }) => {
  const agent = await getAgentById(params.id!)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.organizationId) {
    const isMember = await isOrgMember(session.user.id, agent.organizationId)
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const tools = await getAgentTools(params.id!)
  return NextResponse.json(tools)
})

export const POST = withResourceAuth(async (req, { session, params }) => {
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
    type: "mcp-server" | "function" | "agent"
    referenceId: string
    required?: boolean
    config?: unknown
  }

  const tool = await addAgentTool({
    agentId: params.id!,
    type: body.type,
    referenceId: body.referenceId,
    required: body.required,
    config: body.config,
  })
  return NextResponse.json(tool, { status: 201 })
})
