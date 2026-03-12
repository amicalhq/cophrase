import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { providerTypeEnum, type ProviderType, type ModelType } from "@workspace/db"
import { encrypt } from "@workspace/db/crypto"
import {
  getProvidersByOrg,
  createProvider,
} from "@/lib/data/providers"
import { createModels, getDefaultsForOrg } from "@workspace/db/queries/models"
import { isOrgMember } from "@/lib/data/projects"
import { isSupportedProvider } from "@/lib/ai/registry"

const validProviderTypes = providerTypeEnum.enumValues as readonly string[]

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const providers = await getProvidersByOrg(orgId)
    return NextResponse.json(providers)
  } catch (error) {
    console.error("Failed to fetch providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch providers" },
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

  const { orgId, name, providerType, apiKey, baseURL, models } = body as {
    orgId?: string
    name?: string
    providerType?: string
    apiKey?: string
    baseURL?: string
    models?: Array<{ modelId: string; modelType: string }>
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!providerType || !validProviderTypes.includes(providerType)) {
    return NextResponse.json(
      { error: "Invalid provider type" },
      { status: 400 },
    )
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "apiKey is required" },
      { status: 400 },
    )
  }
  if (!isSupportedProvider(providerType)) {
    return NextResponse.json(
      { error: "Unsupported provider type" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const apiKeyEnc = encrypt(apiKey)
    const provider = await createProvider({
      organizationId: orgId,
      name: name.trim(),
      providerType: providerType as ProviderType,
      apiKeyEnc,
      baseUrl: baseURL,
    })

    // Create enabled models if provided
    let createdModels: any[] = []
    if (models && models.length > 0) {
      // Check which model types already have defaults
      const existingDefaults = await getDefaultsForOrg(orgId)
      const typesWithDefaults = new Set(
        existingDefaults.map((d) => d.modelType),
      )

      // Group models by type to determine which gets default
      const modelsByType = new Map<string, typeof models>()
      for (const m of models) {
        const group = modelsByType.get(m.modelType) ?? []
        group.push(m)
        modelsByType.set(m.modelType, group)
      }

      const modelsToInsert = models.map((m) => {
        const typeGroup = modelsByType.get(m.modelType)!
        const isFirstOfType =
          typeGroup[0] === m && !typesWithDefaults.has(m.modelType as ModelType)
        return {
          organizationId: orgId,
          providerId: provider.id,
          modelId: m.modelId,
          modelType: m.modelType as ModelType,
          isDefault: isFirstOfType,
        }
      })

      createdModels = await createModels(modelsToInsert)
    }

    return NextResponse.json(
      { provider, models: createdModels },
      { status: 201 },
    )
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A provider with this name already exists in this organization" },
        { status: 409 },
      )
    }
    console.error("Failed to create provider:", error)
    return NextResponse.json(
      { error: "Failed to create provider" },
      { status: 500 },
    )
  }
}
