import type { LanguageModel } from "ai"
import { getModelById, getDefaultsForOrg } from "@workspace/db/queries/models"
import { getProviderById } from "@workspace/db/queries/providers"
import { decrypt } from "@workspace/db/crypto"
import { SUPPORTED_PROVIDERS, isSupportedProvider } from "@/lib/ai/registry"
import { withDevTools } from "@/lib/ai/devtools"
import type { ProviderType } from "@workspace/db"

/**
 * Resolves a model into an AI SDK LanguageModel.
 *
 * If modelId is provided, loads that specific model. If null, falls back to
 * the org's default language model. Built-in agents use modelId=null so they
 * inherit the org's default.
 */
export async function resolveModel(
  modelId: string | null,
  organizationId: string
): Promise<LanguageModel> {
  let resolvedModelId = modelId

  // Fall back to org default language model if no specific model
  if (!resolvedModelId) {
    const defaults = await getDefaultsForOrg(organizationId)
    const defaultLanguageModel = defaults.find(
      (d) => d.modelType === "language"
    )
    if (!defaultLanguageModel) {
      throw new Error(
        `No default language model configured for org ${organizationId}. Please set a default model in Settings > Models.`
      )
    }
    resolvedModelId = defaultLanguageModel.modelId
  }

  const model = await getModelById(resolvedModelId)
  if (!model) {
    throw new Error(`Model not found: ${resolvedModelId}`)
  }

  const provider = await getProviderById(model.providerId, organizationId)
  if (!provider) {
    throw new Error(
      `Provider not found: ${model.providerId} for org ${organizationId}`
    )
  }

  const providerType = provider.providerType as ProviderType
  if (!isSupportedProvider(providerType)) {
    throw new Error(`Unsupported provider type: ${providerType}`)
  }

  const apiKey = decrypt(provider.apiKeyEnc)
  const config = SUPPORTED_PROVIDERS[providerType]
  const client = config.factory({
    apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
  })

  const languageModel = client(model.modelId) as LanguageModel
  return withDevTools(languageModel)
}

export interface ResolvedModelMeta {
  modelRecordId: string    // "aim_xxx" (our DB record ID)
  providerRecordId: string // "aip_xxx" (our DB record ID)
  providerType: string     // "openai", "groq", "ai-gateway"
  modelName: string        // "gpt-5.4-mini", "llama-3-70b"
}

/**
 * Returns denormalized audit metadata for a model without creating an SDK client.
 * If modelId is null, resolves the org's default language model.
 * Used in a separate "use step" so the result is serializable.
 */
export async function getModelMeta(
  modelId: string | null,
  organizationId: string
): Promise<ResolvedModelMeta> {
  let resolvedModelId = modelId

  if (!resolvedModelId) {
    const defaults = await getDefaultsForOrg(organizationId)
    const defaultLanguageModel = defaults.find(
      (d) => d.modelType === "language"
    )
    if (!defaultLanguageModel) {
      throw new Error(
        `No default language model configured for org ${organizationId}. Please set a default model in Settings > Models.`
      )
    }
    resolvedModelId = defaultLanguageModel.modelId
  }

  const model = await getModelById(resolvedModelId)
  if (!model) {
    throw new Error(`Model not found: ${resolvedModelId}`)
  }

  if (model.organizationId !== organizationId) {
    throw new Error(`Model ${resolvedModelId} does not belong to org ${organizationId}`)
  }

  return {
    modelRecordId: model.id,
    providerRecordId: model.providerId,
    providerType: model.providerType,
    modelName: model.modelId,
  }
}
