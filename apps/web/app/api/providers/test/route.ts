// apps/web/app/api/providers/test/route.ts
import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { type ProviderType } from "@workspace/db"
import { decrypt } from "@workspace/db/crypto"
import { isOrgMember } from "@/lib/data/projects"
import { getProviderById } from "@/lib/data/providers"
import { isSupportedProvider } from "@/lib/ai/registry"
import { testProviderConnection } from "@/lib/ai/test-connection"

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

  const { orgId, providerType, apiKey, baseURL, providerId } = body as {
    orgId?: string
    providerType?: string
    apiKey?: string
    baseURL?: string
    providerId?: string
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve provider type and API key
  let resolvedType: ProviderType
  let resolvedKey: string
  let resolvedBaseURL: string | undefined = baseURL

  try {
    if (providerId) {
      // Edit dialog: resolve from stored provider
      const provider = await getProviderById(providerId, orgId)
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        )
      }
      resolvedType = provider.providerType
      resolvedKey = apiKey?.trim() || decrypt(provider.apiKeyEnc)
      resolvedBaseURL = baseURL ?? provider.baseUrl ?? undefined
    } else {
      // Add dialog: credentials provided directly
      if (!providerType || !isSupportedProvider(providerType)) {
        return NextResponse.json(
          { error: "Invalid provider type" },
          { status: 400 }
        )
      }
      if (!apiKey?.trim()) {
        return NextResponse.json(
          { error: "apiKey is required" },
          { status: 400 }
        )
      }
      resolvedType = providerType as ProviderType
      resolvedKey = apiKey.trim()
    }

    const result = await testProviderConnection({
      providerType: resolvedType,
      apiKey: resolvedKey,
      baseURL: resolvedBaseURL,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("Provider test connection error:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
