import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { getStagesByContentType } from "@workspace/db/queries/content-types"
import { isOrgMember } from "@/lib/data/projects"
import { generateInitialSuggestions } from "@/lib/harness/suggestions"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params
  const content = await getContentByIdOnly(contentId)
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  const isMember = await isOrgMember(session.user.id, content.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const stages = await getStagesByContentType(content.contentTypeId)
  const suggestions = generateInitialSuggestions(
    stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    content.currentStageId,
  )

  return NextResponse.json({ suggestions })
}
