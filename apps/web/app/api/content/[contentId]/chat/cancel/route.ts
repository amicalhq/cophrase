import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { isOrgMember } from "@/lib/data/projects"
import { db, eq, and } from "@workspace/db"
import { agentRun } from "@workspace/db/schema"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
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

  // Cancel any running agent runs for this content.
  // The workflow SDK (4.2.0-beta.68) does not yet export cancelRun —
  // sub-agent step functions check run status at step boundaries and
  // abort if the status is "cancelled".
  const cancelled = await db
    .update(agentRun)
    .set({ status: "cancelled" })
    .where(
      and(eq(agentRun.contentId, contentId), eq(agentRun.status, "running"))
    )
    .returning({ id: agentRun.id })

  return NextResponse.json({
    cancelledRuns: cancelled.map((r) => r.id),
  })
}
