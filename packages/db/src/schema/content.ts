import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core"
import { organization, user } from "./auth"
import { project } from "./projects"
import { contentType, contentTypeStage } from "./content-types"
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
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("Untitled"),
    contentTypeId: text("content_type_id")
      .notNull()
      .references(() => contentType.id),
    currentStageId: text("current_stage_id").references(
      () => contentTypeStage.id,
      { onDelete: "set null" },
    ),
    frontmatter: jsonb("frontmatter").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("content_organizationId_idx").on(table.organizationId),
    index("content_projectId_idx").on(table.projectId),
    index("content_content_type_id_idx").on(table.contentTypeId),
    index("content_current_stage_id_idx").on(table.currentStageId),
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
  contentType: one(contentType, {
    fields: [content.contentTypeId],
    references: [contentType.id],
  }),
  currentStage: one(contentTypeStage, {
    fields: [content.currentStageId],
    references: [contentTypeStage.id],
  }),
}))
