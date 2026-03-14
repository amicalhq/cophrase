import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createArtifactId } from "@workspace/id"
import { artifactStatusEnum } from "./enums"
import { organization } from "./auth"
import { project } from "./projects"
import { content } from "./content"
import { agent } from "./agents"

export const artifact = pgTable(
  "artifact",
  {
    id: text("id").primaryKey().$defaultFn(createArtifactId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    contentId: text("content_id").references(() => content.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id").notNull(), // No FK — built-in agents live in code, not DB
    runId: text("run_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").notNull(),
    version: integer("version").notNull().default(1),
    status: artifactStatusEnum("status").notNull().default("ready"),
    parentIds: jsonb("parent_ids").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("artifact_project_id_idx").on(table.projectId),
    index("artifact_content_id_idx").on(table.contentId),
    index("artifact_run_id_idx").on(table.runId),
    index("artifact_agent_id_idx").on(table.agentId),
    index("artifact_org_type_idx").on(table.organizationId, table.type),
    uniqueIndex("artifact_content_type_version_idx").on(
      table.contentId,
      table.type,
      table.version,
    ),
  ],
)

export const artifactRelations = relations(artifact, ({ one }) => ({
  organization: one(organization, {
    fields: [artifact.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [artifact.projectId],
    references: [project.id],
  }),
  content: one(content, {
    fields: [artifact.contentId],
    references: [content.id],
  }),
  agent: one(agent, {
    fields: [artifact.agentId],
    references: [agent.id],
  }),
}))
