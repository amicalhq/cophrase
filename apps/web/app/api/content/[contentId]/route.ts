import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { deleteContent, getContentById } from "@/lib/data/content"
import { isOrgMember } from "@/lib/data/projects"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params
  const orgId = request.nextUrl.searchParams.get("orgId")
  const projectId = request.nextUrl.searchParams.get("projectId")

  if (!orgId || !projectId) {
    return NextResponse.json(
      { error: "orgId and projectId are required" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await getContentById(contentId, projectId)
  if (!existing) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  try {
    const deleted = await deleteContent(contentId, orgId)
    if (!deleted) {
      return NextResponse.json(
        { error: "Content not found" },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete content:", error)
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 },
    )
  }
}
