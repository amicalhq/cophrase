import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { getArtifactById } from "@workspace/db/queries/artifacts"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contentId: string; artifactId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId, artifactId } = await params

  const contentRow = await getContentByIdOnly(contentId)
  if (!contentRow) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  const isMember = await isOrgMember(session.user.id, contentRow.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const artifact = await getArtifactById(artifactId)
  if (
    !artifact ||
    artifact.contentId !== contentId ||
    artifact.organizationId !== contentRow.organizationId
  ) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 })
  }

  return NextResponse.json({ artifact })
}
