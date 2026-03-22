import { z } from "zod"
import {
  getResourcesByProject,
  getResourceById,
  getResourceContent,
} from "@workspace/db/queries/resources"
import { isOrgMember } from "@workspace/db/queries/projects"
import type { ResourceType, ResourceCategory } from "@workspace/db/schema"
import type { McpContext } from "@/lib/mcp/types"

export const listResources = {
  description:
    "List resources in a project. Optionally filter by type or category. Requires membership in the organization.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
    projectId: z.string().describe("The ID of the project"),
    type: z
      .enum(["text", "link", "file"])
      .optional()
      .describe("Optional: filter by resource type"),
    category: z
      .enum([
        "brand_voice",
        "product_features",
        "visual_identity",
        "documentation",
        "competitor_info",
        "target_audience",
        "website",
        "other",
      ])
      .optional()
      .describe("Optional: filter by resource category"),
  }),
  handler: async (
    input: {
      organizationId: string
      projectId: string
      type?: ResourceType
      category?: ResourceCategory
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

    const resources = await getResourcesByProject(
      input.projectId,
      input.organizationId,
      { type: input.type, category: input.category },
    )

    return {
      content: [{ type: "text" as const, text: JSON.stringify(resources) }],
    }
  },
}

export const getResource = {
  description:
    "Get details and inline content of a resource. Requires membership in the organization.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
    projectId: z.string().describe("The ID of the project"),
    resourceId: z.string().describe("The ID of the resource"),
  }),
  handler: async (
    input: {
      organizationId: string
      projectId: string
      resourceId: string
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

    const resource = await getResourceById(
      input.resourceId,
      input.projectId,
      input.organizationId,
    )
    if (!resource) {
      return {
        content: [{ type: "text" as const, text: "Resource not found" }],
        isError: true,
      }
    }

    const content = await getResourceContent(input.resourceId)

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ...resource, content }),
        },
      ],
    }
  },
}
