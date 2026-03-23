import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

interface CreateSeedDbOptions {
  envFiles?: Array<string | undefined>
  forbidProduction?: boolean
}

export function createSeedDb({
  envFiles = [],
  forbidProduction = false,
}: CreateSeedDbOptions = {}) {
  if (!process.env.DATABASE_URL) {
    for (const envFile of envFiles) {
      if (!envFile) continue

      process.loadEnvFile(envFile)
      if (process.env.DATABASE_URL) break
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Set it in the environment or provide an env file."
    )
  }

  if (forbidProduction && process.env.NODE_ENV === "production") {
    throw new Error("This seed script must not run in production.")
  }

  const client = postgres(process.env.DATABASE_URL)
  const db = drizzle(client)

  return { client, db }
}
