import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getContentByIdOnly, getContentFrontmatter, updateContentFrontmatter } from "@workspace/db/queries/content"
import { isOrgMember } from "@/lib/data/projects"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contentId } = await params
  const result = await getContentFrontmatter(contentId)
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ frontmatter: result.frontmatter ?? {}, contentTypeId: result.contentTypeId })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contentId } = await params
  const content = await getContentByIdOnly(contentId)
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isMember = await isOrgMember(session.user.id, content.organizationId)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json()) as { frontmatter: Record<string, unknown> }
  const updated = await updateContentFrontmatter(contentId, body.frontmatter)
  return NextResponse.json(updated)
}
