import { relations, sql } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"
import { aiProvider } from "./providers"
import { modelTypeEnum } from "./enums"
import { createAiModelId } from "@workspace/id"

export const aiModel = pgTable(
  "ai_model",
  {
    id: text("id").primaryKey().$defaultFn(createAiModelId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => aiProvider.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    modelType: modelTypeEnum("model_type").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("ai_model_organizationId_idx").on(table.organizationId),
    index("ai_model_providerId_idx").on(table.providerId),
    uniqueIndex("ai_model_provider_model_idx").on(
      table.providerId,
      table.modelId,
    ),
    // Partial unique index: one default per (org, model_type)
    uniqueIndex("ai_model_default_idx")
      .on(table.organizationId, table.modelType)
      .where(sql`is_default = true`),
  ],
)

export const aiModelRelations = relations(aiModel, ({ one }) => ({
  organization: one(organization, {
    fields: [aiModel.organizationId],
    references: [organization.id],
  }),
  provider: one(aiProvider, {
    fields: [aiModel.providerId],
    references: [aiProvider.id],
  }),
}))

// Define aiProviderRelations here (not in providers.ts) to avoid circular imports
// since models.ts already imports aiProvider from providers.ts
export const aiProviderRelations = relations(aiProvider, ({ one, many }) => ({
  organization: one(organization, {
    fields: [aiProvider.organizationId],
    references: [organization.id],
  }),
  models: many(aiModel),
}))
