import { eq, asc, desc } from "drizzle-orm"
import { db } from "../index"
import { agentRun, agentMessage } from "../schema/agent-runs"
import type { RunStatus, ExecutionMode, MessageRole } from "../schema/enums"

export async function createAgentRun(input: {
  organizationId: string
  projectId: string
  contentId?: string
  agentId: string
  createdBy: string
  workflowRunId?: string
  input?: unknown
  executionMode?: ExecutionMode
}) {
  const [result] = await db
    .insert(agentRun)
    .values({ ...input, startedAt: new Date() })
    .returning()
  if (!result) throw new Error("Failed to insert agent run row")
  return result
}

export async function getAgentRunById(id: string) {
  const [result] = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.id, id))
  return result ?? null
}

export async function getAgentRunsByContent(contentId: string) {
  return await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.contentId, contentId))
    .orderBy(desc(agentRun.createdAt))
}

export async function updateAgentRunStatus(
  id: string,
  status: RunStatus,
  extra?: {
    workflowRunId?: string
    error?: { code: string; message: string }
    completedAt?: Date
  },
) {
  const [result] = await db
    .update(agentRun)
    .set({ status, ...extra })
    .where(eq(agentRun.id, id))
    .returning()
  return result ?? null
}

export async function saveMessages(
  runId: string,
  messages: Array<{
    id: string
    role: MessageRole
    parts: unknown
    metadata?: unknown
  }>,
) {
  if (messages.length === 0) return
  await db.insert(agentMessage).values(
    messages.map((m) => ({
      id: m.id,
      runId,
      role: m.role,
      parts: m.parts,
      metadata: m.metadata,
    })),
  )
}

export async function getMessagesByRun(runId: string) {
  return await db
    .select()
    .from(agentMessage)
    .where(eq(agentMessage.runId, runId))
    .orderBy(asc(agentMessage.createdAt))
}

export async function getExistingMessageIds(
  runId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: agentMessage.id })
    .from(agentMessage)
    .where(eq(agentMessage.runId, runId))
  return new Set(rows.map((r) => r.id))
}
