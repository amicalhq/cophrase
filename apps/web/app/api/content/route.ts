import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import {
  getContentByProject,
  createContent,
  deleteContentBulk,
} from "@/lib/data/content"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"

const MAX_TITLE_LENGTH = 200

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get("projectId")
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    )
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  try {
    const contentList = await getContentByProject(projectId)
    return NextResponse.json(contentList)
  } catch (error) {
    console.error("Failed to fetch content:", error)
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ids, orgId } = body as { ids?: string[]; orgId?: string }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids array is required" },
      { status: 400 },
    )
  }
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const deleted = await deleteContentBulk(ids, orgId)
    return NextResponse.json({ deleted: deleted.length })
  } catch (error) {
    console.error("Failed to bulk delete content:", error)
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, orgId, title, contentTypeId } = body as {
    projectId?: string
    orgId?: string
    title?: string
    contentTypeId?: string
  }

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    )
  }
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }
  if (!contentTypeId) {
    return NextResponse.json(
      { error: "contentTypeId is required" },
      { status: 400 }
    )
  }

  const trimmedTitle = title?.trim() || "Untitled"
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
      { status: 400 }
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  try {
    const created = await createContent({
      projectId,
      organizationId: project.organizationId,
      createdBy: session.user.id,
      title: trimmedTitle,
      contentTypeId,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create content:", error)
    return NextResponse.json(
      { error: "Failed to create content" },
      { status: 500 }
    )
  }
}
