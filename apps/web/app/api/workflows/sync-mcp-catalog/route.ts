import { start } from "workflow/api"
import { syncMcpCatalog } from "@workspace/workflows"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key")
  if (!key || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const run = await start(syncMcpCatalog)

  return NextResponse.json({
    message: "MCP catalog sync workflow started",
    runId: run.runId,
  })
}
