import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { contentTypeEnum, type ContentType } from "@workspace/db"
import { getContentByProject, createContent } from "@/lib/data/content"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"

const validTypes = contentTypeEnum.enumValues as readonly string[]
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
      { status: 400 },
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const { projectId, orgId, title, type } = body as {
    projectId?: string
    orgId?: string
    title?: string
    type?: string
  }

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    )
  }
  if (!orgId) {
    return NextResponse.json(
      { error: "orgId is required" },
      { status: 400 },
    )
  }
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: "type must be 'blog' or 'social'" },
      { status: 400 },
    )
  }

  const trimmedTitle = title?.trim() || "Untitled"
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
      { status: 400 },
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
      type: type as ContentType,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create content:", error)
    return NextResponse.json(
      { error: "Failed to create content" },
      { status: 500 },
    )
  }
}
