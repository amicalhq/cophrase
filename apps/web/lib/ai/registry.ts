import { createOpenAI } from "@ai-sdk/openai"
import { createGroq } from "@ai-sdk/groq"
import { createGateway } from "ai"

export const SUPPORTED_PROVIDERS = {
  openai: {
    name: "OpenAI",
    factory: createOpenAI,
    fields: ["apiKey"] as const,
    optionalFields: ["baseURL"] as const,
  },
  groq: {
    name: "Groq",
    factory: createGroq,
    fields: ["apiKey"] as const,
    optionalFields: [] as const,
  },
  "ai-gateway": {
    name: "Vercel AI Gateway",
    factory: createGateway,
    fields: ["apiKey"] as const,
    optionalFields: ["baseURL"] as const,
  },
} as const

// Use ProviderType from @workspace/db, not a separate type here
export function isSupportedProvider(type: string): boolean {
  return type in SUPPORTED_PROVIDERS
}
