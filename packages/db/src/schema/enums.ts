import { pgEnum } from "drizzle-orm/pg-core"

export const providerTypeEnum = pgEnum("provider_type", [
  "openai",
  "groq",
  "ai-gateway",
])
export type ProviderType = (typeof providerTypeEnum.enumValues)[number]

export const modelTypeEnum = pgEnum("model_type", [
  "language",
  "embedding",
  "image",
  "video",
])
export type ModelType = (typeof modelTypeEnum.enumValues)[number]

export const contentTypeEnum = pgEnum("content_type", ["blog", "social"])
export type ContentType = (typeof contentTypeEnum.enumValues)[number]

export const contentStageEnum = pgEnum("content_stage", [
  "idea",
  "draft",
  "review",
  "ready",
  "published",
])
export type ContentStage = (typeof contentStageEnum.enumValues)[number]

export const resourceTypeEnum = pgEnum("resource_type", ["text", "link", "file"])
export type ResourceType = (typeof resourceTypeEnum.enumValues)[number]

export const resourceCategoryEnum = pgEnum("resource_category", [
  "brand_voice",
  "product_features",
  "visual_identity",
  "documentation",
  "competitor_info",
  "target_audience",
  "website",
  "other",
])
export type ResourceCategory = (typeof resourceCategoryEnum.enumValues)[number]

export const agentScopeEnum = pgEnum("agent_scope", ["app", "org"])
export type AgentScope = (typeof agentScopeEnum.enumValues)[number]

export const executionModeEnum = pgEnum("execution_mode", [
  "auto",
  "approve-each",
  "approve-selective",
])
export type ExecutionMode = (typeof executionModeEnum.enumValues)[number]

export const agentToolTypeEnum = pgEnum("agent_tool_type", [
  "mcp-server",
  "function",
  "agent",
])
export type AgentToolType = (typeof agentToolTypeEnum.enumValues)[number]

export const artifactStatusEnum = pgEnum("artifact_status", [
  "pending",
  "ready",
  "approved",
  "rejected",
])
export type ArtifactStatus = (typeof artifactStatusEnum.enumValues)[number]

export const runStatusEnum = pgEnum("run_status", [
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
])
export type RunStatus = (typeof runStatusEnum.enumValues)[number]

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "tool",
])
export type MessageRole = (typeof messageRoleEnum.enumValues)[number]

export const mcpConnectionStatusEnum = pgEnum("mcp_connection_status", [
  "active",
  "inactive",
  "error",
])
export type McpConnectionStatus = (typeof mcpConnectionStatusEnum.enumValues)[number]
