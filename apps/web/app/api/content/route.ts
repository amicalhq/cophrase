import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByProject, createContent } from "@/lib/data/content"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get("projectId")
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 },
    )
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const contentList = await getContentByProject(projectId)
  return NextResponse.json(contentList)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
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
  if (!type || !["blog", "social"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'blog' or 'social'" },
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

  const created = await createContent({
    projectId,
    organizationId: project.organizationId,
    createdBy: session.user.id,
    title: title?.trim() || "Untitled",
    type: type as "blog" | "social",
  })

  return NextResponse.json(created, { status: 201 })
}
