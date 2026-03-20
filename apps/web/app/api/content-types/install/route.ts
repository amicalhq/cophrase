import { NextResponse } from "next/server"
import { withOrgAuth } from "@/lib/api/with-auth"
import {
  getContentTypeById,
  installContentType,
} from "@/lib/data/content-types"
import { getProjectByIdAndOrg } from "@/lib/data/projects"

export const POST = withOrgAuth(
  async (req, { session: _session, orgId }) => {
    const { templateId, projectId } = (await req.json()) as {
      templateId?: string
      projectId?: string
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 },
      )
    }
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      )
    }

    const template = await getContentTypeById(templateId)
    if (!template || template.scope !== "app") {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      )
    }

    const project = await getProjectByIdAndOrg(projectId, orgId)
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      )
    }

    const installed = await installContentType({ templateId, projectId, orgId })
    return NextResponse.json(installed, { status: 201 })
  },
  { orgIdFrom: "body" },
)
