export type AvailableModel = {
  id: string
  name: string
  type: "language" | "embedding" | "image" | "video"
  capabilities: string[]
  contextWindow: number | null
  pricing: { input?: string; output?: string; image?: string } | null
  releaseDate: string | null
}
