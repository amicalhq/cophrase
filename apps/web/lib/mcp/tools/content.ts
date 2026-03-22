import { z } from "zod"
import {
  getContentByProject,
  getContentByIdOnly,
  createContent,
  updateContentFrontmatter,
} from "@workspace/db/queries/content"
import { getArtifactsByContent } from "@workspace/db/queries/artifacts"
import { getContentTypeById } from "@workspace/db/queries/content-types"
import { isOrgMember, getProjectByIdAndOrg } from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const listContent = {
  description:
    "List all content items within a project. Optionally filter by content type.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
    projectId: z.string().describe("The ID of the project"),
    contentTypeId: z
      .string()
      .optional()
      .describe("Optional: filter by content type ID"),
  }),
  handler: async (
    input: { organizationId: string; projectId: string; contentTypeId?: string },
    ctx: McpContext,
  ) => {
    const isMember = await isOrgMember(ctx.userId, input.organizationId)
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

    const project = await getProjectByIdAndOrg(input.projectId, input.organizationId)
    if (!project) {
      return {
        content: [
          { type: "text" as const, text: "Project not found in this organization" },
        ],
        isError: true,
      }
    }

    const items = await getContentByProject(input.projectId)
    const filtered = input.contentTypeId
      ? items.filter((item) => item.contentTypeId === input.contentTypeId)
      : items

    return {
      content: [{ type: "text" as const, text: JSON.stringify(filtered) }],
    }
  },
}

export const getContent = {
  description:
    "Get a content item by ID, including its artifacts.",
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

    const artifacts = await getArtifactsByContent(input.contentId)

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ...contentItem, artifacts }),
        },
      ],
    }
  },
}

export const createContentItem = {
  description:
    "Create a new content item in a project. Requires membership in the organization.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
    projectId: z.string().describe("The ID of the project"),
    contentTypeId: z.string().describe("The ID of the content type"),
    title: z.string().describe("Title of the content item"),
    frontmatter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional frontmatter key/value pairs"),
  }),
  handler: async (
    input: {
      organizationId: string
      projectId: string
      contentTypeId: string
      title: string
      frontmatter?: Record<string, unknown>
    },
    ctx: McpContext,
  ) => {
    const isMember = await isOrgMember(ctx.userId, input.organizationId)
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

    const project = await getProjectByIdAndOrg(input.projectId, input.organizationId)
    if (!project) {
      return {
        content: [
          { type: "text" as const, text: "Project not found in this organization" },
        ],
        isError: true,
      }
    }

    const ct = await getContentTypeById(input.contentTypeId)
    if (!ct) {
      return {
        content: [
          { type: "text" as const, text: "Content type not found" },
        ],
        isError: true,
      }
    }

    // Verify the content type belongs to this project or is an app-scoped template
    if (ct.scope !== "app" && ct.projectId !== input.projectId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Content type does not belong to this project",
          },
        ],
        isError: true,
      }
    }

    const created = await createContent({
      projectId: input.projectId,
      organizationId: input.organizationId,
      createdBy: ctx.userId,
      title: input.title,
      contentTypeId: input.contentTypeId,
    })

    if (input.frontmatter) {
      await updateContentFrontmatter(created.id, input.frontmatter)
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(created) }],
    }
  },
}
