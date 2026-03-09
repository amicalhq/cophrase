import {
  boolean,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { aiProviderEnum } from "./enums"
import { createAiProviderId } from "@workspace/id"

export const aiProviders = pgTable("ai_providers", {
  id: text("id").primaryKey().$defaultFn(createAiProviderId),
  name: text("name").notNull(),
  provider: aiProviderEnum("provider").notNull().unique(),
  description: text("description"),
  website: text("website"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
