import type { LanguageModel } from "ai"
import {
  getModelById,
  getDefaultsForOrg,
} from "@workspace/db/queries/models"
import { getProviderById } from "@workspace/db/queries/providers"
import { decrypt } from "@workspace/db/crypto"
import {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
} from "@/lib/ai/registry"
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
  organizationId: string,
): Promise<LanguageModel> {
  let resolvedModelId = modelId

  // Fall back to org default language model if no specific model
  if (!resolvedModelId) {
    const defaults = await getDefaultsForOrg(organizationId)
    const defaultLanguageModel = defaults.find(
      (d) => d.modelType === "language",
    )
    if (!defaultLanguageModel) {
      throw new Error(
        `No default language model configured for org ${organizationId}. Please set a default model in Settings > Models.`,
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
      `Provider not found: ${model.providerId} for org ${organizationId}`,
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

  return client(model.modelId) as LanguageModel
}
