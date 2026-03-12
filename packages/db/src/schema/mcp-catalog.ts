import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createMcpCatalogId } from "@workspace/id"

export const mcpCatalog = pgTable("mcp_catalog", {
  id: text("id").primaryKey().$defaultFn(createMcpCatalogId),
  name: text("name").notNull().unique(),
  source: text("source").notNull(),
  title: text("title"),
  description: text("description"),
  version: text("version"),
  websiteUrl: text("website_url"),
  repositoryUrl: text("repository_url"),
  repositorySource: text("repository_source"),
  icons: jsonb("icons"),
  remotes: jsonb("remotes"),
  packages: jsonb("packages"),
  excluded: boolean("excluded").default(false).notNull(), // hide from UI catalog (future use)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
})
