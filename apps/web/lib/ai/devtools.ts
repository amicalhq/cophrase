import type { LanguageModel } from "ai"
import { wrapLanguageModel } from "ai"

/**
 * Wraps a model with AI SDK DevTools middleware in development.
 * Captures all LLM calls to .devtools/generations.json for inspection.
 * No-op in production.
 */
export async function withDevTools(model: LanguageModel): Promise<LanguageModel> {
  if (process.env.NODE_ENV !== "development") return model
  if (typeof model === "string" || model.specificationVersion !== "v3")
    return model

  const { devToolsMiddleware } = await import("@ai-sdk/devtools")
  return wrapLanguageModel({ model, middleware: devToolsMiddleware() })
}
