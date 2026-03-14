import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
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
        { status: 404 },
      )
    }

    const isMember = await isOrgMember(session.user.id, agentRun.organizationId)
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      id: agentRun.id,
      status: agentRun.status,
      agentId: agentRun.agentId,
      organizationId: agentRun.organizationId,
      projectId: agentRun.projectId,
      contentId: agentRun.contentId,
      executionMode: agentRun.executionMode,
      error: agentRun.error,
      createdAt: agentRun.createdAt,
      startedAt: agentRun.startedAt,
      completedAt: agentRun.completedAt,
    })
  } catch (error) {
    console.error("Failed to fetch agent run:", error)
    return NextResponse.json(
      { error: "Failed to fetch agent run" },
      { status: 500 },
    )
  }
}
