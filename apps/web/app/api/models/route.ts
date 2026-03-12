import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { createModels, deleteModels } from "@/lib/data/models"
import type { ModelType } from "@workspace/db"

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

  const { orgId, add, remove } = body as {
    orgId?: string
    add?: Array<{ providerId: string; modelId: string; modelType: string }>
    remove?: string[]
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    let added: { id: string; modelId: string; modelType: string; isDefault: boolean }[] = []
    let removed: { id: string; modelType: string; isDefault: boolean }[] = []

    if (remove && remove.length > 0) {
      removed = await deleteModels(remove, orgId)
    }

    if (add && add.length > 0) {
      added = await createModels(
        add.map((m) => ({
          organizationId: orgId,
          providerId: m.providerId,
          modelId: m.modelId,
          modelType: m.modelType as ModelType,
        })),
      )
    }

    return NextResponse.json({ added, removed })
  } catch (error) {
    console.error("Failed to update models:", error)
    return NextResponse.json(
      { error: "Failed to update models" },
      { status: 500 },
    )
  }
}
