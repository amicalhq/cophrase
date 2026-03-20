import { eq, asc, desc, and, inArray } from "drizzle-orm"
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
    id?: string
    role: MessageRole
    parts: unknown
    metadata?: unknown
  }>,
) {
  if (messages.length === 0) return
  await db.insert(agentMessage).values(
    messages.map((m) => ({
      ...(m.id ? { id: m.id } : {}),
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

/**
 * Returns a Set of agentIds that have at least one completed run
 * for the given contentId.
 */
export async function getCompletedRunsByAgentIds(
  agentIds: string[],
  contentId: string,
): Promise<Set<string>> {
  if (agentIds.length === 0) return new Set()
  const rows = await db
    .select({ agentId: agentRun.agentId })
    .from(agentRun)
    .where(
      and(
        inArray(agentRun.agentId, agentIds),
        eq(agentRun.contentId, contentId),
        eq(agentRun.status, "completed"),
      ),
    )
    .groupBy(agentRun.agentId)
  return new Set(rows.map((r) => r.agentId))
}
