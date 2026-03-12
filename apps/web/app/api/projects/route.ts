import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import {
  getProjectsByOrg,
  isOrgMember,
  createProject,
} from "@/lib/data/projects"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const projects = await getProjectsByOrg(orgId)
  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, orgId } = body as {
    name?: string
    description?: string
    orgId?: string
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (name.trim().length > 255) {
    return NextResponse.json(
      { error: "name must be 255 characters or less" },
      { status: 400 },
    )
  }
  if (description && description.length > 2000) {
    return NextResponse.json(
      { error: "description must be 2000 characters or less" },
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

  const project = await createProject({
    name: name.trim(),
    description: description?.trim() || undefined,
    organizationId: orgId,
  })

  return NextResponse.json(project, { status: 201 })
}
