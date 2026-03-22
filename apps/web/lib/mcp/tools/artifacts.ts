import { z } from "zod"
import {
  getArtifactsSummaryByContent,
  getArtifactById,
  createArtifact,
  updateArtifactStatus,
  getNextArtifactVersion,
} from "@workspace/db/queries/artifacts"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { isOrgMember } from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const listArtifacts = {
  description:
    "List all artifacts (summary) for a content item, ordered by most recent first.",
  inputSchema: z.object({
    contentId: z.string().describe("The ID of the content item"),
  }),
  handler: async (
    input: { contentId: string },
    ctx: McpContext,
  ) => {
    const contentItem = await getContentByIdOnly(input.contentId)
    if (!contentItem) {
      return {
        content: [{ type: "text" as const, text: "Content not found" }],
        isError: true,
      }
    }

    const isMember = await isOrgMember(ctx.userId, contentItem.organizationId)
    if (!isMember) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Access denied: not a member of this organization",
          },
        ],
        isError: true,
      }
    }

    const artifacts = await getArtifactsSummaryByContent(input.contentId)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(artifacts) }],
    }
  },
}

export const getArtifact = {
  description: "Get the full details of an artifact by ID, including its data.",
  inputSchema: z.object({
    artifactId: z.string().describe("The ID of the artifact"),
  }),
  handler: async (
    input: { artifactId: string },
    ctx: McpContext,
  ) => {
    const artifact = await getArtifactById(input.artifactId)
    if (!artifact) {
      return {
        content: [{ type: "text" as const, text: "Artifact not found" }],
        isError: true,
      }
    }

    const isMember = await isOrgMember(ctx.userId, artifact.organizationId)
    if (!isMember) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Access denied: not a member of this organization",
          },
        ],
        isError: true,
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(artifact) }],
    }
  },
}

export const saveArtifact = {
  description:
    "Save a new artifact for a content item. The version is auto-incremented based on existing artifacts of the same type. Status defaults to 'ready'.",
  inputSchema: z.object({
    contentId: z.string().describe("The ID of the content item"),
    type: z.string().describe("The artifact type (e.g. 'draft', 'outline')"),
    title: z.string().describe("A human-readable title for the artifact"),
    data: z.record(z.string(), z.unknown()).describe("The artifact payload data"),
    parentIds: z
      .array(z.string())
      .optional()
      .describe("Optional IDs of parent artifacts this was derived from"),
  }),
  handler: async (
    input: {
      contentId: string
      type: string
      title: string
      data: Record<string, unknown>
      parentIds?: string[]
    },
    ctx: McpContext,
  ) => {
    const contentItem = await getContentByIdOnly(input.contentId)
    if (!contentItem) {
      return {
        content: [{ type: "text" as const, text: "Content not found" }],
        isError: true,
      }
    }

    const isMember = await isOrgMember(ctx.userId, contentItem.organizationId)
    if (!isMember) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Access denied: not a member of this organization",
          },
        ],
        isError: true,
      }
    }

    const version = await getNextArtifactVersion(input.contentId, input.type)

    const artifact = await createArtifact({
      organizationId: contentItem.organizationId,
      projectId: contentItem.projectId,
      contentId: input.contentId,
      agentId: null,
      runId: null,
      type: input.type,
      title: input.title,
      data: input.data,
      version,
      status: "ready",
      parentIds: input.parentIds,
    })

    return {
      content: [{ type: "text" as const, text: JSON.stringify(artifact) }],
    }
  },
}

export const updateArtifactStatusTool = {
  description:
    "Update the approval status of an artifact to 'approved' or 'rejected'.",
  inputSchema: z.object({
    artifactId: z.string().describe("The ID of the artifact"),
    status: z
      .enum(["approved", "rejected"])
      .describe("The new status for the artifact"),
  }),
  handler: async (
    input: { artifactId: string; status: "approved" | "rejected" },
    ctx: McpContext,
  ) => {
    const artifact = await getArtifactById(input.artifactId)
    if (!artifact) {
      return {
        content: [{ type: "text" as const, text: "Artifact not found" }],
        isError: true,
      }
    }

    const isMember = await isOrgMember(ctx.userId, artifact.organizationId)
    if (!isMember) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Access denied: not a member of this organization",
          },
        ],
        isError: true,
      }
    }

    const updated = await updateArtifactStatus(input.artifactId, input.status)
    if (!updated) {
      return {
        content: [{ type: "text" as const, text: "Artifact not found" }],
        isError: true,
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated) }],
    }
  },
}
