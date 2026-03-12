import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getProjectsByOrg } from "@/lib/data/projects"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = request.nextUrl.searchParams.get("orgId")
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 })
  }

  const projects = await getProjectsByOrg(orgId)
  return NextResponse.json(projects)
}
