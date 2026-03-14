import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { resumeHook } from "workflow/api"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { toolCallId, approved, edits } = body as {
    toolCallId?: string
    approved?: boolean
    edits?: unknown
  }

  if (!toolCallId) {
    return NextResponse.json(
      { error: "toolCallId is required" },
      { status: 400 },
    )
  }
  if (approved === undefined) {
    return NextResponse.json(
      { error: "approved is required" },
      { status: 400 },
    )
  }

  try {
    const agentRun = await getAgentRunById(runId)
    if (!agentRun) {
      return NextResponse.json(
        { error: "Agent run not found" },
        { status: 404 },
      )
    }

    // Resume the approval hook with the decision
    await resumeHook(`approval:${runId}:${toolCallId}`, {
      approved,
      comment: typeof edits === "string" ? edits : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to process approval:", error)
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 },
    )
  }
}
