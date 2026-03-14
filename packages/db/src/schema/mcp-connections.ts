import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createMcpConnectionId } from "@workspace/id"
import { mcpConnectionStatusEnum } from "./enums"
import { organization } from "./auth"
import { mcpCatalog } from "./mcp-catalog"

export const mcpConnection = pgTable(
  "mcp_connection",
  {
    id: text("id").primaryKey().$defaultFn(createMcpConnectionId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id")
      .notNull()
      .references(() => mcpCatalog.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    authCredentialsEnc: text("auth_credentials_enc"),
    baseUrlOverride: text("base_url_override"),
    status: mcpConnectionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("mcp_connection_org_id_idx").on(table.organizationId),
  ],
)

export const mcpConnectionRelations = relations(
  mcpConnection,
  ({ one }) => ({
    organization: one(organization, {
      fields: [mcpConnection.organizationId],
      references: [organization.id],
    }),
    catalog: one(mcpCatalog, {
      fields: [mcpConnection.catalogId],
      references: [mcpCatalog.id],
    }),
  }),
)
