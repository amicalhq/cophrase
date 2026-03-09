import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"

const globalForDb = globalThis as unknown as {
  pgClient: postgres.Sql | undefined
}

function getClient() {
  if (globalForDb.pgClient) return globalForDb.pgClient

  const client = postgres(process.env.DATABASE_URL!)

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pgClient = client
  }

  return client
}

export const db = drizzle(getClient(), { schema })

export type Database = typeof db

export { schema }
export * from "./schema/index"
export { asc, desc, eq, and, or, sql, inArray } from "drizzle-orm"
