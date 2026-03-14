import { z } from "zod"
import { tool } from "ai"
import {
  createArtifact,
  getNextArtifactVersion,
} from "@workspace/db/queries/artifacts"
import { updateContentStage } from "@workspace/db/queries/content"
import type { RunContext } from "../types"

/**
 * Creates a save-artifact tool bound to the given run context.
 * The tool saves an artifact (e.g. research notes, blog draft) to the database.
 * When a "blog-draft" type artifact is saved, it also advances the content stage to "draft".
 */
export function createSaveArtifactTool(ctx: RunContext) {
  return tool({
    description:
      "Save an artifact (research notes, blog draft, etc.) to the database. " +
      "Use this to persist work products that should be available to other agents or the user.",
    inputSchema: z.object({
      type: z
        .string()
        .describe(
          'The artifact type, e.g. "research-notes", "blog-draft", "outline", "humanized-draft"',
        ),
      title: z.string().describe("A short title for the artifact"),
      data: z
        .record(z.string(), z.unknown())
        .describe("The artifact payload as a JSON object"),
      parentIds: z
        .array(z.string())
        .optional()
        .describe("Optional IDs of parent artifacts this is derived from"),
    }),
    execute: async ({ type, title, data, parentIds }) => {
      "use step"

      const version = ctx.contentId
        ? await getNextArtifactVersion(ctx.contentId, type)
        : 1

      const artifact = await createArtifact({
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        contentId: ctx.contentId,
        agentId: ctx.agentId,
        runId: ctx.runId,
        type,
        title,
        data,
        version,
        parentIds,
      })

      // Advance content stage when a blog draft is saved
      if (type === "blog-draft" && ctx.contentId) {
        await updateContentStage(ctx.contentId, "draft")
      }

      return {
        artifactId: artifact.id,
        type: artifact.type,
        title: artifact.title,
        version: artifact.version,
      }
    },
  })
}
