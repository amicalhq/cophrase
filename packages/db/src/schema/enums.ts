import { pgEnum } from "drizzle-orm/pg-core"

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "anthropic",
  "google",
  "groq",
  "lmstudio",
  "claudecode",
  "custom",
])

export const contentTypeEnum = pgEnum("content_type", ["blog", "social"])

export const contentStageEnum = pgEnum("content_stage", [
  "idea",
  "draft",
  "review",
  "ready",
  "published",
])
