import { z } from "zod"
import { tool } from "ai"
import { searchArtifacts } from "@workspace/db/queries/artifacts"
import type { ArtifactStatus } from "@workspace/db"
import type { RunContext } from "../types"

/**
 * Creates a search-artifacts tool bound to the given run context.
 * Searches for artifacts within the organization, optionally filtered by content, run, type, or status.
 */
export function createSearchArtifactsTool(ctx: RunContext) {
  return tool({
    description:
      "Search for existing artifacts within the current organization. " +
      "Filter by content, run, type, or status to find relevant work products.",
    inputSchema: z.object({
      contentId: z
        .string()
        .optional()
        .describe("Filter by content ID (defaults to current content)"),
      runId: z
        .string()
        .optional()
        .describe("Filter by agent run ID"),
      type: z
        .string()
        .optional()
        .describe(
          'Filter by artifact type, e.g. "research-notes", "blog-draft"',
        ),
      status: z
        .enum(["pending", "ready", "approved", "rejected"])
        .optional()
        .describe("Filter by artifact status"),
    }),
    execute: async ({ contentId, runId, type, status }) => {
      "use step"

      const results = await searchArtifacts({
        organizationId: ctx.organizationId,
        contentId: contentId ?? ctx.contentId,
        runId,
        type,
        status: status as ArtifactStatus | undefined,
      })

      return {
        count: results.length,
        artifacts: results.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          version: a.version,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        })),
      }
    },
  })
}
