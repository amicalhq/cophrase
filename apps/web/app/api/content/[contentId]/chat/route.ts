import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { z } from "zod"
import { createUIMessageStreamResponse } from "ai"
import { start } from "workflow/api"
import { getContentByIdOnly } from "@workspace/db/queries/content"
import { saveHarnessMessages } from "@workspace/db/queries/harness-messages"
import { isOrgMember } from "@/lib/data/projects"
import { runHarnessWorkflow } from "@/lib/harness/run-harness"

// Accept both { message: string } (simple) and { messages: [...] } (useChat format)
const chatSchema = z.union([
  z.object({ message: z.string().min(1) }),
  z.object({
    messages: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
        })
      )
      .min(1),
  }),
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const contentRow = await getContentByIdOnly(contentId)
  if (!contentRow) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 })
  }

  const isMember = await isOrgMember(session.user.id, contentRow.organizationId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // Extract the user message from either format
    const data = parsed.data
    const messageText =
      "message" in data
        ? data.message
        : data.messages[data.messages.length - 1]!.content
    const userMessage = JSON.stringify({ role: "user", content: messageText })

    // Persist the user message immediately so it survives workflow failures
    await saveHarnessMessages([
      {
        organizationId: contentRow.organizationId,
        contentId,
        role: "user" as const,
        parts: messageText,
      },
    ])

    const workflowRun = await start(runHarnessWorkflow, [
      {
        contentId,
        contentTypeId: contentRow.contentTypeId,
        contentTitle: contentRow.title,
        organizationId: contentRow.organizationId,
        projectId: contentRow.projectId,
        createdBy: session.user.id,
      },
      userMessage,
    ])

    return createUIMessageStreamResponse({
      stream: workflowRun.readable,
      headers: {
        "x-workflow-run-id": workflowRun.runId,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start harness"
    console.error("Failed to start harness workflow:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
