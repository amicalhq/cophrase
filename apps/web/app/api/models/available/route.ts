import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"
import { isSupportedProvider } from "@/lib/ai/registry"
import { getAvailableModels } from "@/lib/ai/available-models"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const providerType = request.nextUrl.searchParams.get("providerType")
  if (!providerType || !isSupportedProvider(providerType)) {
    return NextResponse.json(
      { error: "Valid providerType is required" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const models = await getAvailableModels(providerType)
    // Sort by release date descending (newest first)
    models.sort((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return 0
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return b.releaseDate.localeCompare(a.releaseDate)
    })
    return NextResponse.json(models)
  } catch (error) {
    console.error("Failed to fetch available models:", error)
    return NextResponse.json(
      { error: "Failed to fetch available models" },
      { status: 500 },
    )
  }
}
