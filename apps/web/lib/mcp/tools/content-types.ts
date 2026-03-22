import { z } from "zod"
import {
  getContentTypesByProject,
  getContentTypeWithStages,
  getContentTypeById,
} from "@workspace/db/queries/content-types"
import { isOrgMember, getProjectByIdAndOrg } from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const listContentTypes = {
  description:
    "List all content types (and their stages) within a project.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
    projectId: z.string().describe("The ID of the project"),
  }),
  handler: async (
    input: { organizationId: string; projectId: string },
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

    const contentTypes = await getContentTypesByProject(input.projectId)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(contentTypes) }],
    }
  },
}

export const getContentType = {
  description:
    "Get a content type with its full stage and sub-agent configuration.",
  inputSchema: z.object({
    contentTypeId: z.string().describe("The ID of the content type"),
  }),
  handler: async (
    input: { contentTypeId: string },
    ctx: McpContext,
  ) => {
    const ct = await getContentTypeById(input.contentTypeId)
    if (!ct) {
      return {
        content: [
          { type: "text" as const, text: "Content type not found" },
        ],
        isError: true,
      }
    }

    if (ct.organizationId) {
      const isMember = await isOrgMember(ctx.userId, ct.organizationId)
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
    }

    const contentType = await getContentTypeWithStages(input.contentTypeId)
    if (!contentType) {
      return {
        content: [
          { type: "text" as const, text: "Content type not found" },
        ],
        isError: true,
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(contentType) }],
    }
  },
}
