import { z } from "zod"
import { tool } from "ai"
import { getArtifactById } from "@workspace/db/queries/artifacts"

/**
 * Creates a load-artifact tool that retrieves a single artifact by ID.
 */
export function createLoadArtifactTool() {
  return tool({
    description:
      "Load a previously saved artifact by its ID. " +
      "Use this to retrieve research notes, drafts, or other work products.",
    inputSchema: z.object({
      artifactId: z.string().describe("The ID of the artifact to load"),
    }),
    execute: async ({ artifactId }) => {
      "use step"

      const artifact = await getArtifactById(artifactId)
      if (!artifact) {
        return { error: `Artifact not found: ${artifactId}` }
      }

      return {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        data: artifact.data,
        version: artifact.version,
        status: artifact.status,
        createdAt: artifact.createdAt.toISOString(),
      }
    },
  })
}
