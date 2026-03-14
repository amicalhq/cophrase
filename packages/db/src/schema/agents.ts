import {
  index,
  jsonb,
  pgTable,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createAgentId, createAgentToolId } from "@workspace/id"
import {
  agentScopeEnum,
  executionModeEnum,
  agentToolTypeEnum,
} from "./enums"
import { organization } from "./auth"
import { aiModel } from "./models"

export const agent = pgTable(
  "agent",
  {
    id: text("id").primaryKey().$defaultFn(createAgentId),
    scope: agentScopeEnum("scope").notNull(),
    organizationId: text("organization_id").references(
      () => organization.id,
      { onDelete: "cascade" },
    ),
    name: text("name").notNull(),
    description: text("description").notNull(),
    modelId: text("model_id").references(() => aiModel.id, {
      onDelete: "set null",
    }),
    prompt: text("prompt").notNull(),
    inputSchema: jsonb("input_schema"),
    outputSchema: jsonb("output_schema"),
    executionMode: executionModeEnum("execution_mode")
      .notNull()
      .default("auto"),
    approvalSteps: jsonb("approval_steps").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("agent_organization_id_idx").on(table.organizationId)],
)

export const agentRelations = relations(agent, ({ one, many }) => ({
  organization: one(organization, {
    fields: [agent.organizationId],
    references: [organization.id],
  }),
  model: one(aiModel, {
    fields: [agent.modelId],
    references: [aiModel.id],
  }),
  tools: many(agentTool),
}))

export const agentTool = pgTable(
  "agent_tool",
  {
    id: text("id").primaryKey().$defaultFn(createAgentToolId),
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    type: agentToolTypeEnum("type").notNull(),
    referenceId: text("reference_id").notNull(),
    required: boolean("required").notNull().default(true),
    config: jsonb("config"),
  },
  (table) => [
    index("agent_tool_agent_id_idx").on(table.agentId),
    index("agent_tool_reference_idx").on(table.referenceId, table.type),
  ],
)

export const agentToolRelations = relations(agentTool, ({ one }) => ({
  agent: one(agent, {
    fields: [agentTool.agentId],
    references: [agent.id],
  }),
}))
