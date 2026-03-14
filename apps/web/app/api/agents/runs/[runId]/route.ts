import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { createUIMessageStreamResponse } from "ai"
import { getRun } from "workflow/api"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"

export async function GET(
  request: NextRequest,
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

    if (!agentRun.workflowRunId) {
      return NextResponse.json(
        { error: "Workflow run not available" },
        { status: 404 },
      )
    }

    const startIndex = Number(
      request.nextUrl.searchParams.get("startIndex") ?? "0",
    )

    const run = getRun(agentRun.workflowRunId)

    return createUIMessageStreamResponse({
      stream: run.getReadable({ startIndex }),
    })
  } catch (error) {
    console.error("Failed to reconnect to agent run:", error)
    return NextResponse.json(
      { error: "Failed to reconnect to agent run" },
      { status: 500 },
    )
  }
}
