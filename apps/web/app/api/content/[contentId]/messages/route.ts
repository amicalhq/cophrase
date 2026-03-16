import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { getHarnessMessages } from "@workspace/db/queries/harness-messages"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor") ?? undefined
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50)

  const contentRow = await getContentByIdOnly(contentId)
  if (!contentRow) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  const isMember = await isOrgMember(session.user.id, contentRow.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { messages, nextCursor } = await getHarnessMessages(contentId, { cursor, limit })

  return NextResponse.json({ messages, nextCursor })
}
