import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"
import { isOrgMember } from "@/lib/data/projects"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = await params

  try {
    const agentRun = await getAgentRunById(runId)
    if (!agentRun) {
      return NextResponse.json(
        { error: "Agent run not found" },
        { status: 404 }
      )
    }

    const isMember = await isOrgMember(session.user.id, agentRun.organizationId)
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      { error: "Multi-turn messaging is deferred to post-v1" },
      { status: 501 }
    )
  } catch (error) {
    console.error("Failed to send message to agent run:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
