import { z } from "zod"
import {
  getProjectsByOrg,
  getProjectByIdAndOrg,
  isOrgMember,
} from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const listProjects = {
  description:
    "List all projects within an organization. Requires membership in the organization.",
  inputSchema: z.object({
    organizationId: z.string().describe("The ID of the organization"),
  }),
  handler: async (
    input: { organizationId: string },
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

    const projects = await getProjectsByOrg(input.organizationId)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(projects) }],
    }
  },
}

export const getProject = {
  description:
    "Get details of a specific project by ID. Requires membership in the organization.",
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

    const project = await getProjectByIdAndOrg(
      input.projectId,
      input.organizationId,
    )
    if (!project) {
      return {
        content: [
          { type: "text" as const, text: "Project not found" },
        ],
        isError: true,
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(project) }],
    }
  },
}
