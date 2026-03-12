import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { organization } from "./auth"
import { createProjectId } from "@workspace/id"

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey().$defaultFn(createProjectId),
    name: text("name").notNull(),
    description: text("description"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_organizationId_idx").on(table.organizationId),
  ],
)

export const projectRelations = relations(project, ({ one }) => ({
  organization: one(organization, {
    fields: [project.organizationId],
    references: [organization.id],
  }),
}))
