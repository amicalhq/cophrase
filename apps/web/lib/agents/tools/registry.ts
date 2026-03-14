import type { ToolSet } from "ai"
import { webSearchTool } from "./web-search"
import { createLoadArtifactTool } from "./load-artifact"
import { createSaveArtifactTool } from "./save-artifact"
import { createSearchArtifactsTool } from "./search-artifacts"
import type { RunContext } from "../types"

/**
 * Built-in function tools that do not require a RunContext.
 * These can be used directly without any binding.
 */
export const builtInTools: ToolSet = {
  "web-search": webSearchTool,
  "load-artifact": createLoadArtifactTool(),
}

/**
 * Factory functions for tools that require a RunContext.
 * Each factory takes a RunContext and returns a bound tool.
 */
export const contextToolFactories: Record<
  string,
  (ctx: RunContext) => ToolSet[string]
> = {
  "save-artifact": createSaveArtifactTool,
  "search-artifacts": createSearchArtifactsTool,
}

/**
 * Looks up a function tool by name from the built-in registry.
 * For context-dependent tools, returns the factory function's result
 * when a RunContext is provided.
 */
export function getFunctionFromRegistry(
  name: string,
  ctx?: RunContext,
): ToolSet[string] | null {
  if (name in builtInTools) {
    return builtInTools[name]!
  }

  if (name in contextToolFactories && ctx) {
    return contextToolFactories[name]!(ctx)
  }

  return null
}
