import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"
import { organization, user } from "./auth"
import { project } from "./projects"
import { contentTypeEnum, contentStageEnum } from "./enums"
import { createContentId } from "@workspace/id"

export const content = pgTable(
  "content",
  {
    id: text("id").primaryKey().$defaultFn(createContentId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    type: contentTypeEnum("type").notNull(),
    stage: contentStageEnum("stage").notNull().default("idea"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("content_organizationId_idx").on(table.organizationId),
    index("content_projectId_idx").on(table.projectId),
    index("content_stage_idx").on(table.stage),
  ],
)

export const contentRelations = relations(content, ({ one }) => ({
  organization: one(organization, {
    fields: [content.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [content.projectId],
    references: [project.id],
  }),
  creator: one(user, {
    fields: [content.createdBy],
    references: [user.id],
  }),
}))
