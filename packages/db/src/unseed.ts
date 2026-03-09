import { drizzle } from "drizzle-orm/postgres-js"
import { inArray } from "drizzle-orm"
import postgres from "postgres"
import { aiProviders } from "./schema/index"

process.loadEnvFile("../../.env.local")

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

const SEED_IDS = [
  "aip_seed00001",
  "aip_seed00002",
  "aip_seed00003",
  "aip_seed00004",
  "aip_seed00005",
  "aip_seed00006",
  "aip_seed00007",
]

async function unseed() {
  console.log("Removing seed data from ai_providers...")

  const result = await db
    .delete(aiProviders)
    .where(inArray(aiProviders.id, SEED_IDS))
    .returning({ id: aiProviders.id })

  console.log(`Removed ${result.length} seed ai_providers.`)
  await client.end()
}

unseed().catch((err) => {
  console.error("Unseed failed:", err)
  process.exit(1)
})
