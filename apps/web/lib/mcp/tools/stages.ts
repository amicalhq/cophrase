import { z } from "zod"
import { getStageWithContext } from "@workspace/db/queries/content-types"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { isOrgMember } from "@workspace/db/queries/projects"
import type { McpContext } from "@/lib/mcp/types"

export const getStageInstructions = {
  description:
    "Get stage instructions, sub-agent tools, and prior artifacts for a given stage and content item. Use this to understand what work a stage requires.",
  inputSchema: z.object({
    contentId: z.string().describe("The ID of the content item"),
    stageId: z.string().describe("The ID of the content type stage"),
  }),
  handler: async (
    input: { contentId: string; stageId: string },
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

    const stageContext = await getStageWithContext(
      input.stageId,
      input.contentId,
    )
    if (!stageContext) {
      return {
        content: [{ type: "text" as const, text: "Stage not found" }],
        isError: true,
      }
    }

    // Verify the stage belongs to the content's content type
    if (stageContext.stage.contentTypeId !== contentItem.contentTypeId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Stage does not belong to this content item's content type",
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(stageContext) },
      ],
    }
  },
}
