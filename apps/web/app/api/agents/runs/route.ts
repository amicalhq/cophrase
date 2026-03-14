import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { createUIMessageStreamResponse } from "ai"
import type { ModelMessage } from "ai"
import { start } from "workflow/api"
import { getBuiltInAgent } from "@/lib/agents/built-in/registry"
import { getAgentById } from "@workspace/db/queries/agents"
import {
  createAgentRun,
  updateAgentRunStatus,
} from "@workspace/db/queries/agent-runs"
import { orchestratorChat } from "@/lib/agents/run-agent"
import type { ExecutionMode } from "@workspace/db"
import type { AgentConfig, RunContext } from "@/lib/agents/types"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { agentId, messages, organizationId, projectId, contentId, executionMode } =
    body as {
      agentId?: string
      messages?: ModelMessage[]
      organizationId?: string
      projectId?: string
      contentId?: string
      executionMode?: ExecutionMode
    }

  if (!agentId) {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 },
    )
  }
  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "messages are required" },
      { status: 400 },
    )
  }
  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId is required" },
      { status: 400 },
    )
  }
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    )
  }

  // Resolve agent: built-in first, then DB
  let agentConfig: AgentConfig | null = getBuiltInAgent(agentId)
  if (!agentConfig) {
    const dbAgent = await getAgentById(agentId)
    if (!dbAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }
    agentConfig = {
      id: dbAgent.id,
      scope: dbAgent.scope,
      organizationId: dbAgent.organizationId,
      name: dbAgent.name,
      description: dbAgent.description,
      modelId: dbAgent.modelId,
      prompt: dbAgent.prompt,
      inputSchema: dbAgent.inputSchema,
      outputSchema: dbAgent.outputSchema,
      executionMode: dbAgent.executionMode,
      approvalSteps: dbAgent.approvalSteps as string[] | null,
    }
  }

  try {
    // Create agent run record
    const run = await createAgentRun({
      organizationId,
      projectId,
      contentId,
      agentId,
      createdBy: session.user.id,
      executionMode: executionMode ?? agentConfig.executionMode,
    })

    const context: RunContext = {
      organizationId,
      projectId,
      contentId: contentId ?? "",
      agentId,
      runId: run.id,
    }

    // Start the workflow
    const workflowRun = await start(orchestratorChat, [
      agentConfig,
      messages,
      run.id,
      context,
    ])

    // Update run with workflow run ID
    await updateAgentRunStatus(run.id, "running", {
      workflowRunId: workflowRun.runId,
    })

    // Return streaming response with run metadata headers
    return createUIMessageStreamResponse({
      stream: workflowRun.readable,
      headers: {
        "x-run-id": run.id,
        "x-workflow-run-id": workflowRun.runId,
      },
    })
  } catch (error) {
    console.error("Failed to start agent run:", error)
    return NextResponse.json(
      { error: "Failed to start agent run" },
      { status: 500 },
    )
  }
}
