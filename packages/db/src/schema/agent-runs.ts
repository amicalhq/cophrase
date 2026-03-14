import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createAgentRunId, createAgentMessageId } from "@workspace/id"
import { runStatusEnum, executionModeEnum, messageRoleEnum } from "./enums"
import { organization, user } from "./auth"
import { project } from "./projects"
import { content } from "./content"
import { agent } from "./agents"

export const agentRun = pgTable(
  "agent_run",
  {
    id: text("id").primaryKey().$defaultFn(createAgentRunId),
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
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    workflowRunId: text("workflow_run_id"),
    status: runStatusEnum("status").notNull().default("running"),
    input: jsonb("input"),
    error: jsonb("error").$type<{ code: string; message: string }>(),
    executionMode: executionModeEnum("execution_mode")
      .notNull()
      .default("auto"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("agent_run_project_id_idx").on(table.projectId),
    index("agent_run_content_id_idx").on(table.contentId),
    index("agent_run_agent_id_idx").on(table.agentId),
    index("agent_run_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("agent_run_created_by_idx").on(table.createdBy),
    index("agent_run_workflow_run_id_idx").on(table.workflowRunId),
  ],
)

export const agentRunRelations = relations(agentRun, ({ one, many }) => ({
  organization: one(organization, {
    fields: [agentRun.organizationId],
    references: [organization.id],
  }),
  project: one(project, {
    fields: [agentRun.projectId],
    references: [project.id],
  }),
  content: one(content, {
    fields: [agentRun.contentId],
    references: [content.id],
  }),
  agent: one(agent, {
    fields: [agentRun.agentId],
    references: [agent.id],
  }),
  creator: one(user, {
    fields: [agentRun.createdBy],
    references: [user.id],
  }),
  messages: many(agentMessage),
}))

export const agentMessage = pgTable(
  "agent_message",
  {
    id: text("id").primaryKey().$defaultFn(createAgentMessageId),
    runId: text("run_id")
      .notNull()
      .references(() => agentRun.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_message_run_id_created_idx").on(
      table.runId,
      table.createdAt,
    ),
  ],
)

export const agentMessageRelations = relations(agentMessage, ({ one }) => ({
  run: one(agentRun, {
    fields: [agentMessage.runId],
    references: [agentRun.id],
  }),
}))
