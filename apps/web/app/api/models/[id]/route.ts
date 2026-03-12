import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { deleteModelById, promoteNextDefault } from "@/lib/data/models"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const deleted = await deleteModelById(id, orgId)
    if (!deleted) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 })
    }

    // If the deleted model was the default, promote the next one
    if (deleted.isDefault) {
      await promoteNextDefault(deleted.organizationId, deleted.modelType)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete model:", error)
    return NextResponse.json(
      { error: "Failed to delete model" },
      { status: 500 },
    )
  }
}
