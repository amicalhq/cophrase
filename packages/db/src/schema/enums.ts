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
