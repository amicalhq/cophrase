import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { aiProviders, content } from "./schema/index"
import { user, organization, member, account } from "./schema/auth"
import { project } from "./schema/projects"
import { sql } from "drizzle-orm"

process.loadEnvFile("../../.env.local")

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

// All seed IDs use a deterministic "seed" prefix so they can be cleanly upserted/deleted
// Login: sam.altman@cophrase.ai / password

const SEED_USER = {
  id: "seed_user_0001",
  name: "Sam Altman",
  email: "sam.altman@cophrase.ai",
  emailVerified: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// Pre-computed scrypt hash of "password" using better-auth's hashPassword()
const SEED_ACCOUNT = {
  id: "seed_account_01",
  accountId: SEED_USER.id,
  providerId: "credential",
  userId: SEED_USER.id,
  password:
    "9ecd95b57a89353fe9a64f8cb41be5a9:105ca1b614590327dc0dad960f9c2faae2116e7348d05b048fad3a806de9b7254374ba0a271cbfec800df336c5ffbbd80ffadbbcde52dba7e6694553536aa6de",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const SEED_ORG = {
  id: "seed_org_00001",
  name: "OpenAI",
  slug: "openai",
  createdAt: new Date("2026-01-01"),
}

const SEED_MEMBER = {
  id: "seed_member_01",
  organizationId: SEED_ORG.id,
  userId: SEED_USER.id,
  role: "owner",
  createdAt: new Date("2026-01-01"),
}

const SEED_PROJECT = {
  id: "seed_proj_001",
  name: "ChatGPT Launch",
  organizationId: SEED_ORG.id,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

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

const SEED_CONTENT = [
  {
    id: "ct_seed00001",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "How to Scale Your Startup in 2026",
    type: "blog" as const,
    stage: "ready" as const,
  },
  {
    id: "ct_seed00002",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "Product Hunt Launch Announcement",
    type: "social" as const,
    stage: "review" as const,
  },
  {
    id: "ct_seed00003",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "AI in Content Marketing — Deep Dive",
    type: "blog" as const,
    stage: "draft" as const,
  },
  {
    id: "ct_seed00004",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "Weekly Tips Thread",
    type: "social" as const,
    stage: "idea" as const,
  },
  {
    id: "ct_seed00005",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "SEO Best Practices Guide",
    type: "blog" as const,
    stage: "published" as const,
  },
]

async function seed() {
  // 1. Seed user
  console.log("Seeding user...")
  await db
    .insert(user)
    .values(SEED_USER)
    .onConflictDoUpdate({
      target: user.id,
      set: { name: sql`excluded.name`, email: sql`excluded.email` },
    })

  // 2. Seed account (credential login)
  console.log("Seeding account...")
  await db
    .insert(account)
    .values(SEED_ACCOUNT)
    .onConflictDoUpdate({
      target: account.id,
      set: { password: sql`excluded.password` },
    })

  // 3. Seed organization
  console.log("Seeding organization...")
  await db
    .insert(organization)
    .values(SEED_ORG)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: sql`excluded.name`, slug: sql`excluded.slug` },
    })

  // 4. Seed member
  console.log("Seeding member...")
  await db
    .insert(member)
    .values(SEED_MEMBER)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: sql`excluded.role` },
    })

  // 5. Seed project
  console.log("Seeding project...")
  await db
    .insert(project)
    .values(SEED_PROJECT)
    .onConflictDoUpdate({
      target: project.id,
      set: { name: sql`excluded.name` },
    })

  // 6. Seed ai_providers
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

  // 7. Seed content
  console.log("Seeding content pieces...")
  for (const item of SEED_CONTENT) {
    await db
      .insert(content)
      .values(item)
      .onConflictDoUpdate({
        target: content.id,
        set: {
          title: sql`excluded.title`,
          type: sql`excluded.type`,
          stage: sql`excluded.stage`,
          updatedAt: sql`now()`,
        },
      })
  }
  console.log(`Seeded ${SEED_CONTENT.length} content pieces.`)

  await client.end()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
