import { NextResponse } from "next/server"
import { withOrgAuth } from "@/lib/api/with-auth"
import { getContentTypesByProject } from "@/lib/data/content-types"

export const GET = withOrgAuth(async (req, { session: _session }) => {
  const projectId = req.nextUrl.searchParams.get("projectId")
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    )
  }

  const contentTypes = await getContentTypesByProject(projectId)
  return NextResponse.json(contentTypes)
})
