import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { isOrgMember } from "@/lib/data/projects"
import { db, eq, and } from "@workspace/db"
import { agentRun } from "@workspace/db/schema"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params

  const contentRow = await getContentByIdOnly(contentId)
  if (!contentRow) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  const isMember = await isOrgMember(session.user.id, contentRow.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 1. Cancel the harness workflow if a workflowRunId was provided
  let body: { workflowRunId?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — we still cancel agent runs below
  }

  if (body.workflowRunId) {
    try {
      // cancelRun may be available in newer workflow SDK versions
      const runtime = (await import("workflow/runtime")) as Record<string, unknown>
      if (typeof runtime.cancelRun === "function") {
        await (runtime.cancelRun as (id: string) => Promise<void>)(body.workflowRunId)
      }
    } catch (err) {
      // Non-fatal: sub-agent cancellation below still works
      console.error("Failed to cancel harness workflow:", err)
    }
  }

  // 2. Cancel any running agent runs for this content (sub-agents)
  const cancelled = await db
    .update(agentRun)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(agentRun.contentId, contentId),
        eq(agentRun.status, "running"),
      ),
    )
    .returning({ id: agentRun.id })

  return NextResponse.json({
    cancelledRuns: cancelled.map((r) => r.id),
    workflowCancelled: !!body.workflowRunId,
  })
}
