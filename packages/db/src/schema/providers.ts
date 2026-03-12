import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"
import { providerTypeEnum } from "./enums"
import { createAiProviderId } from "@workspace/id"

export const aiProvider = pgTable(
  "ai_provider",
  {
    id: text("id").primaryKey().$defaultFn(createAiProviderId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    providerType: providerTypeEnum("provider_type").notNull(),
    apiKeyEnc: text("api_key_enc").notNull(),
    baseUrl: text("base_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("ai_provider_organizationId_idx").on(table.organizationId),
    uniqueIndex("ai_provider_org_name_idx").on(
      table.organizationId,
      table.name,
    ),
  ],
)

export const aiProviderRelations = relations(aiProvider, ({ one }) => ({
  organization: one(organization, {
    fields: [aiProvider.organizationId],
    references: [organization.id],
  }),
}))
