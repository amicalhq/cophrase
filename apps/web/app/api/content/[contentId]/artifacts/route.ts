import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { getArtifactsByContent } from "@workspace/db/queries/artifacts"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
  _request: NextRequest,
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

  const artifacts = await getArtifactsByContent(contentId)

  // Group by type for the picker UI
  const grouped: Record<string, typeof artifacts> = {}
  for (const a of artifacts) {
    ;(grouped[a.type] ??= []).push(a)
  }

  return NextResponse.json({ artifacts, grouped })
}
