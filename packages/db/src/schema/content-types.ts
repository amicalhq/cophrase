import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"
import {
  createContentTypeId,
  createContentTypeStageId,
  createSubAgentId,
} from "@workspace/id"
import { contentFormatEnum, contentTypeScopeEnum } from "./enums"
import { organization } from "./auth"
import { project } from "./projects"
import { agent } from "./agents"

// --- Content Type ---

export const contentType = pgTable(
  "content_type",
  {
    id: text("id").primaryKey().$defaultFn(createContentTypeId),
    scope: contentTypeScopeEnum("scope").notNull(),
    organizationId: text("organization_id").references(
      () => organization.id,
      { onDelete: "cascade" },
    ),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    sourceId: text("source_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    format: contentFormatEnum("format").notNull(),
    frontmatterSchema: jsonb("frontmatter_schema").$type<Record<string, unknown>>(),
    agentId: text("agent_id").references(() => agent.id, {
      onDelete: "set null",
    }),
    icon: text("icon"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("content_type_project_id_idx").on(table.projectId),
    index("content_type_organization_id_idx").on(table.organizationId),
    index("content_type_scope_idx").on(table.scope),
    index("content_type_agent_id_idx").on(table.agentId),
    check(
      "content_type_scope_project_check",
      sql`(scope = 'project' AND organization_id IS NOT NULL AND project_id IS NOT NULL) OR (scope = 'app' AND organization_id IS NULL AND project_id IS NULL)`,
    ),
  ],
)

export const contentTypeRelations = relations(contentType, ({ one, many }) => ({
  organization: one(organization, {
    fields: [contentType.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [contentType.projectId],
    references: [project.id],
  }),
  agent: one(agent, {
    fields: [contentType.agentId],
    references: [agent.id],
  }),
  stages: many(contentTypeStage),
}))

// --- Content Type Stage ---

export const contentTypeStage = pgTable(
  "content_type_stage",
  {
    id: text("id").primaryKey().$defaultFn(createContentTypeStageId),
    contentTypeId: text("content_type_id")
      .notNull()
      .references(() => contentType.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    optional: boolean("optional").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("content_type_stage_content_type_id_idx").on(table.contentTypeId),
    unique("content_type_stage_position_uniq").on(
      table.contentTypeId,
      table.position,
    ),
    unique("content_type_stage_name_uniq").on(
      table.contentTypeId,
      table.name,
    ),
  ],
)

export const contentTypeStageRelations = relations(
  contentTypeStage,
  ({ one, many }) => ({
    contentType: one(contentType, {
      fields: [contentTypeStage.contentTypeId],
      references: [contentType.id],
    }),
    subAgents: many(subAgent),
  }),
)

// --- Sub-Agent (stage → agent binding) ---

export const subAgent = pgTable(
  "sub_agent",
  {
    id: text("id").primaryKey().$defaultFn(createSubAgentId),
    stageId: text("stage_id")
      .notNull()
      .references(() => contentTypeStage.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    executionOrder: integer("execution_order").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sub_agent_stage_id_idx").on(table.stageId),
    index("sub_agent_agent_id_idx").on(table.agentId),
  ],
)

export const subAgentRelations = relations(subAgent, ({ one }) => ({
  stage: one(contentTypeStage, {
    fields: [subAgent.stageId],
    references: [contentTypeStage.id],
  }),
  agent: one(agent, {
    fields: [subAgent.agentId],
    references: [agent.id],
  }),
}))
