import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createHarnessMessageId } from "@workspace/id"
import { messageRoleEnum } from "./enums"
import { organization } from "./auth"
import { content } from "./content"

export const harnessMessage = pgTable(
  "harness_message",
  {
    id: text("id").primaryKey().$defaultFn(createHarnessMessageId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contentId: text("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("harness_message_content_created_idx").on(
      table.contentId,
      table.createdAt,
    ),
    index("harness_message_org_idx").on(table.organizationId),
  ],
)

export const harnessMessageRelations = relations(
  harnessMessage,
  ({ one }) => ({
    organization: one(organization, {
      fields: [harnessMessage.organizationId],
      references: [organization.id],
    }),
    content: one(content, {
      fields: [harnessMessage.contentId],
      references: [content.id],
    }),
  }),
)
