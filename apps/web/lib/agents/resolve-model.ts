import type { CompatibleLanguageModel } from "@workflow/ai/agent"
import { getModelById } from "@workspace/db/queries/models"
import { getProviderById } from "@workspace/db/queries/providers"
import { decrypt } from "@workspace/db/crypto"
import {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
} from "@/lib/ai/registry"
import type { ProviderType } from "@workspace/db"

/**
 * Resolves a model DB record into an AI SDK LanguageModel.
 *
 * Loads the model and its provider from the database, decrypts the API key,
 * and creates the appropriate provider client.
 */
export async function resolveModel(
  modelId: string,
  organizationId: string,
): Promise<CompatibleLanguageModel> {
  const model = await getModelById(modelId)
  if (!model) {
    throw new Error(`Model not found: ${modelId}`)
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

  return client(model.modelId) as CompatibleLanguageModel
}
