import { NextResponse } from "next/server"
import { withOrgAuth } from "@/lib/api/with-auth"
import { createContentTypeFromScratch } from "@/lib/data/content-types"

export const POST = withOrgAuth(
  async (req, { orgId }) => {
    const body = (await req.json()) as {
      projectId: string
      name: string
      description?: string
      format: "rich_text" | "plain_text" | "image" | "video" | "deck"
      frontmatterSchema?: Record<string, unknown>
      stages: Array<{ name: string; position: number; optional?: boolean }>
    }

    const result = await createContentTypeFromScratch({
      projectId: body.projectId,
      orgId,
      name: body.name,
      description: body.description,
      format: body.format,
      frontmatterSchema: body.frontmatterSchema,
      stages: body.stages,
    })

    return NextResponse.json(result, { status: 201 })
  },
  { orgIdFrom: "body" },
)
