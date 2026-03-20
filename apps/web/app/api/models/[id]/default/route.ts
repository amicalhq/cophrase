import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { setDefaultModel } from "@/lib/data/models"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { orgId } = body as { orgId?: string }
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const updated = await setDefaultModel(id, orgId)
    if (!updated) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to set default model:", error)
    return NextResponse.json(
      { error: "Failed to set default model" },
      { status: 500 }
    )
  }
}
