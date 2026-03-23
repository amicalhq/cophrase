import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  jsonb,
} from "drizzle-orm/pg-core"
import { organization, user } from "./auth"
import { project } from "./projects"
import { resourceTypeEnum, resourceCategoryEnum } from "./enums"
import { createResourceId, createResourceContentId } from "@workspace/id"

export const resource = pgTable(
  "resource",
  {
    id: text("id").primaryKey().$defaultFn(createResourceId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    type: resourceTypeEnum("type").notNull(),
    category: resourceCategoryEnum("category").notNull(),
    linkUrl: text("link_url"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileMimeType: text("file_mime_type"),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("resource_organizationId_idx").on(table.organizationId),
    index("resource_projectId_idx").on(table.projectId),
  ],
)

export const resourceContent = pgTable("resource_content", {
  id: text("id").primaryKey().$defaultFn(createResourceContentId),
  resourceId: text("resource_id")
    .notNull()
    .unique()
    .references(() => resource.id, { onDelete: "cascade" }),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const resourceRelations = relations(resource, ({ one }) => ({
  organization: one(organization, {
    fields: [resource.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [resource.projectId],
    references: [project.id],
  }),
  creator: one(user, {
    fields: [resource.createdBy],
    references: [user.id],
  }),
  resourceContent: one(resourceContent, {
    fields: [resource.id],
    references: [resourceContent.resourceId],
  }),
}))

export const resourceContentRelations = relations(
  resourceContent,
  ({ one }) => ({
    resource: one(resource, {
      fields: [resourceContent.resourceId],
      references: [resource.id],
    }),
  }),
)
