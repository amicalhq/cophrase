import type { AvailableModel } from "./types"

// Simple in-memory cache with 24h TTL
const cache = new Map<string, { data: AvailableModel[]; expiresAt: number }>()
const TTL_MS = 24 * 60 * 60 * 1000

async function fetchWithCache(
  key: string,
  fetcher: () => Promise<AvailableModel[]>,
): Promise<AvailableModel[]> {
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }
  const data = await fetcher()
  if (data.length > 0) {
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS })
  }
  return data
}

function inferModelType(model: {
  modalities?: { output?: string[] }
  type?: string
}): AvailableModel["type"] {
  // Gateway API uses "type" field directly
  if (model.type) {
    if (model.type === "language") return "language"
    if (model.type === "embedding") return "embedding"
    if (model.type === "image") return "image"
    if (model.type === "video") return "video"
  }
  // models.dev uses modalities
  const outputs = model.modalities?.output ?? []
  if (outputs.includes("video")) return "video"
  if (outputs.includes("image")) return "image"
  // Embedding models typically have no output modalities listed or only "embedding"
  return "language"
}

async function fetchModelsDevModels(
  providerType: string,
): Promise<AvailableModel[]> {
  const res = await fetch("https://models.dev/api.json")
  if (!res.ok) throw new Error(`models.dev API error: ${res.status}`)
  const data = await res.json()

  const provider = data[providerType]
  if (!provider?.models) return []

  return Object.entries(provider.models).map(
    ([id, model]: [string, any]) => ({
      id,
      name: model.name ?? id,
      type: inferModelType(model),
      capabilities: [
        model.reasoning && "reasoning",
        model.tool_call && "tools",
        model.structured_output && "structured-output",
        model.attachment && "file-input",
        model.modalities?.input?.includes("image") && "vision",
        model.modalities?.input?.includes("audio") && "audio",
      ].filter(Boolean) as string[],
      contextWindow: model.limit?.context ?? null,
      pricing: model.cost
        ? {
            input: model.cost.input?.toString(),
            output: model.cost.output?.toString(),
          }
        : null,
      releaseDate: model.release_date ?? null,
    }),
  )
}

async function fetchGatewayModels(): Promise<AvailableModel[]> {
  const res = await fetch("https://ai-gateway.vercel.sh/v1/models")
  if (!res.ok) throw new Error(`Gateway API error: ${res.status}`)
  const { data: models } = await res.json()

  return models.map((model: any) => ({
    id: model.id,
    name: model.name ?? model.id,
    type: (model.type ?? "language") as AvailableModel["type"],
    capabilities: model.tags ?? [],
    contextWindow: model.context_window ?? null,
    pricing: model.pricing
      ? {
          input: model.pricing.input,
          output: model.pricing.output,
          image: model.pricing.image,
        }
      : null,
    releaseDate: model.released
      ? new Date(model.released * 1000).toISOString().split("T")[0]
      : null,
  }))
}

export async function getAvailableModels(
  providerType: string,
): Promise<AvailableModel[]> {
  const cacheKey = `models:${providerType}`

  return fetchWithCache(cacheKey, async () => {
    if (providerType === "ai-gateway") {
      return fetchGatewayModels()
    }
    return fetchModelsDevModels(providerType)
  })
}
