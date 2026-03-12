import { start } from "workflow/api"
import { syncMcpCatalog } from "@workspace/workflows"
import { NextResponse } from "next/server"

export async function POST() {
  const run = await start(syncMcpCatalog)

  return NextResponse.json({
    message: "MCP catalog sync workflow started",
    runId: run.runId,
  })
}
