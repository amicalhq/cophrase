import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { z } from "zod"
import { createUIMessageStreamResponse, convertToModelMessages } from "ai"
import type { ModelMessage, UIMessage } from "ai"
import { start } from "workflow/api"
import { getAgentById, getAgentTools } from "@workspace/db/queries/agents"
import { createAgentRun } from "@workspace/db/queries/agent-runs"
import { runAgentWorkflow } from "@/lib/agents/run-agent"
import type { WorkflowRunArgs } from "@/lib/agents/run-agent"
import { isOrgMember } from "@/lib/data/projects"
import { getContentById } from "@/lib/data/content"
import type { AgentConfig, AgentToolRecord } from "@/lib/agents/types"

const startRunSchema = z.object({
  agentId: z.string().min(1),
  messages: z.array(z.record(z.string(), z.unknown())).min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  contentId: z.string().optional(),
  executionMode: z
    .enum(["auto", "approve-each", "approve-selective"])
    .optional(),
})

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

  const parsed = startRunSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    agentId,
    messages: rawMessages,
    organizationId,
    projectId,
    contentId,
    executionMode,
  } = parsed.data

  // Convert UIMessages (from WorkflowChatTransport) to ModelMessages (for AI SDK)
  let messages: ModelMessage[]
  const firstMsg = rawMessages[0]!
  if ("parts" in firstMsg) {
    // UIMessage format (has 'parts') — convert
    messages = await convertToModelMessages(
      rawMessages as unknown as UIMessage[]
    )
  } else {
    // Already ModelMessage format
    messages = rawMessages as unknown as ModelMessage[]
  }

  const isMember = await isOrgMember(session.user.id, organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (contentId) {
    const contentItem = await getContentById(contentId, projectId)
    if (!contentItem) {
      return NextResponse.json(
        { error: "Content not found in this project" },
        { status: 404 }
      )
    }
  }

  // Resolve agent from DB
  const dbAgent = await getAgentById(agentId)
  if (!dbAgent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (dbAgent.scope === "org" && dbAgent.organizationId !== organizationId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  const agentConfig: AgentConfig = {
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

  try {
    const run = await createAgentRun({
      organizationId,
      projectId,
      contentId,
      agentId,
      createdBy: session.user.id,
      executionMode: executionMode ?? agentConfig.executionMode,
    })

    // Resolve tool records from DB
    const dbTools = await getAgentTools(agentId)
    const toolRecords = dbTools as AgentToolRecord[]
    const hasSubAgentTools = toolRecords.some((r: AgentToolRecord) => r.type === "agent")

    // Build serializable workflow args
    const workflowArgs: WorkflowRunArgs = {
      agentId,
      agentPrompt: agentConfig.prompt,
      agentModelId: agentConfig.modelId ?? null,
      toolRecords: toolRecords.map((r: AgentToolRecord) => ({
        id: r.id,
        agentId: r.agentId,
        type: r.type,
        referenceId: r.referenceId,
        required: r.required,
        config: r.config,
      })),
      hasSubAgentTools,
      organizationId,
      projectId,
      contentId: contentId ?? undefined,
      runId: run.id,
    }

    // Pass messages as JSON string to avoid workflow devalue serialization issues
    const messagesJson = JSON.stringify(messages)
    const workflowRun = await start(runAgentWorkflow, [
      workflowArgs,
      messagesJson,
    ])

    return createUIMessageStreamResponse({
      stream: workflowRun.readable,
      headers: {
        "x-run-id": run.id,
        "x-workflow-run-id": workflowRun.runId,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start agent run"
    console.error("Failed to start agent run:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
