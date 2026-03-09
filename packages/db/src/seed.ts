import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { aiProviders } from "./schema/index"
import { sql } from "drizzle-orm"

process.loadEnvFile("../../.env.local")

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

const SEED_PROVIDERS = [
  {
    id: "aip_seed00001",
    name: "OpenAI",
    provider: "openai" as const,
    description: "GPT-4o, GPT-4.1, o3 and more",
    website: "https://openai.com",
    isEnabled: true,
  },
  {
    id: "aip_seed00002",
    name: "Anthropic",
    provider: "anthropic" as const,
    description: "Claude 4.5, Claude 4 Opus, Sonnet and Haiku",
    website: "https://anthropic.com",
    isEnabled: true,
  },
  {
    id: "aip_seed00003",
    name: "Google",
    provider: "google" as const,
    description: "Gemini 2.5 Pro, Flash, and more",
    website: "https://ai.google.dev",
    isEnabled: true,
  },
  {
    id: "aip_seed00004",
    name: "Groq",
    provider: "groq" as const,
    description: "Fast inference for open models",
    website: "https://groq.com",
    isEnabled: true,
  },
  {
    id: "aip_seed00005",
    name: "LM Studio",
    provider: "lmstudio" as const,
    description: "Run local models via LM Studio",
    website: "https://lmstudio.ai",
    isEnabled: false,
  },
  {
    id: "aip_seed00006",
    name: "Claude Code",
    provider: "claudecode" as const,
    description: "Claude via Claude Code CLI",
    website: "https://docs.anthropic.com/en/docs/claude-code",
    isEnabled: false,
  },
  {
    id: "aip_seed00007",
    name: "Custom Provider",
    provider: "custom" as const,
    description: "Any OpenAI-compatible API endpoint",
    website: null,
    isEnabled: false,
  },
]

async function seed() {
  console.log("Seeding ai_providers...")

  for (const provider of SEED_PROVIDERS) {
    await db
      .insert(aiProviders)
      .values(provider)
      .onConflictDoUpdate({
        target: aiProviders.id,
        set: {
          name: sql`excluded.name`,
          provider: sql`excluded.provider`,
          description: sql`excluded.description`,
          website: sql`excluded.website`,
          isEnabled: sql`excluded.is_enabled`,
          updatedAt: sql`now()`,
        },
      })
  }

  console.log(`Seeded ${SEED_PROVIDERS.length} ai_providers.`)
  await client.end()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
