import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { encrypt } from "@workspace/db/crypto"
import {
  updateProvider,
  deleteProvider,
} from "@/lib/data/providers"
import { isOrgMember } from "@/lib/data/projects"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const { orgId, name, apiKey, baseURL } = body as {
    orgId?: string
    name?: string
    apiKey?: string
    baseURL?: string | null
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const updateData: Record<string, any> = {}
    if (name?.trim()) updateData.name = name.trim()
    if (apiKey) updateData.apiKeyEnc = encrypt(apiKey)
    if (baseURL !== undefined) updateData.baseUrl = baseURL

    const updated = await updateProvider(id, orgId, updateData)
    if (!updated) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      )
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A provider with this name already exists" },
        { status: 409 },
      )
    }
    console.error("Failed to update provider:", error)
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 },
    )
  }
}

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
    const deleted = await deleteProvider(id, orgId)
    if (!deleted) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete provider:", error)
    return NextResponse.json(
      { error: "Failed to delete provider" },
      { status: 500 },
    )
  }
}
