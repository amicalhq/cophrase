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
