import { z } from "zod"
import { getOrganizationsByUser } from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const listOrganizations = {
  description:
    "List all organizations the current user is a member of. Use this to discover organization IDs needed for other tools.",
  inputSchema: z.object({}),
  handler: async (_input: Record<string, never>, ctx: McpContext) => {
    const orgs = await getOrganizationsByUser(ctx.userId)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(orgs) }],
    }
  },
}
