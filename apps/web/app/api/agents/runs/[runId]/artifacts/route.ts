import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"
import { getArtifactsByRun } from "@workspace/db/queries/artifacts"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
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

    const artifacts = await getArtifactsByRun(runId)

    return NextResponse.json({ artifacts })
  } catch (error) {
    console.error("Failed to fetch artifacts:", error)
    return NextResponse.json(
      { error: "Failed to fetch artifacts" },
      { status: 500 }
    )
  }
}
