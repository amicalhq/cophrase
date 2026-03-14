import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { createUIMessageStreamResponse, convertToModelMessages } from "ai"
import type { ModelMessage, UIMessage } from "ai"
import { getBuiltInAgent } from "@/lib/agents/built-in/registry"
import { getAgentById } from "@workspace/db/queries/agents"
import {
  createAgentRun,
  updateAgentRunStatus,
} from "@workspace/db/queries/agent-runs"
import { runOrchestrator } from "@/lib/agents/run-agent"
import { isOrgMember } from "@/lib/data/projects"
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

  const { agentId, messages: rawMessages, organizationId, projectId, contentId, executionMode } =
    body as {
      agentId?: string
      messages?: UIMessage[] | ModelMessage[]
      organizationId?: string
      projectId?: string
      contentId?: string
      executionMode?: ExecutionMode
    }

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 })
  }
  if (!rawMessages || rawMessages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 })
  }

  // Convert UIMessages (from DefaultChatTransport) to ModelMessages (for AI SDK)
  let messages: ModelMessage[]
  const firstMsg = rawMessages[0]!
  if ("parts" in firstMsg) {
    // UIMessage format (has 'parts') — convert
    messages = await convertToModelMessages(rawMessages as UIMessage[])
  } else {
    // Already ModelMessage format
    messages = rawMessages as ModelMessage[]
  }
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
  }
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  const isMember = await isOrgMember(session.user.id, organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
      contentId: contentId ?? undefined,
      agentId,
      runId: run.id,
    }

    const stream = await runOrchestrator(agentConfig, messages, context)

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "x-run-id": run.id,
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
