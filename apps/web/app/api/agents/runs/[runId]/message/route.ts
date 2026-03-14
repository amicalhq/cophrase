import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import type { ModelMessage } from "ai"
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

  const { message } = body as { message?: ModelMessage }
  if (!message) {
    return NextResponse.json(
      { error: "message is required" },
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

    // Resume the chat message hook with the new message
    await resumeHook(`chat:${runId}`, [message])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to send message to agent run:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    )
  }
}
