import { eq } from "drizzle-orm"
import { db } from "../index"
import { agent, agentTool } from "../schema/agents"

export async function getAgentsByOrg(organizationId: string) {
  return await db
    .select()
    .from(agent)
    .where(eq(agent.organizationId, organizationId))
    .orderBy(agent.name)
}

export async function getAgentById(id: string) {
  const [result] = await db.select().from(agent).where(eq(agent.id, id))
  return result ?? null
}

export async function createAgent(input: {
  scope: "app" | "org"
  organizationId?: string
  name: string
  description: string
  modelId?: string
  prompt: string
  inputSchema?: unknown
  outputSchema?: unknown
  executionMode?: "auto" | "approve-each" | "approve-selective"
  approvalSteps?: string[]
}) {
  const [result] = await db.insert(agent).values(input).returning()
  if (!result) throw new Error("Failed to insert agent row")
  return result
}

export async function getAgentTools(agentId: string) {
  return await db
    .select()
    .from(agentTool)
    .where(eq(agentTool.agentId, agentId))
}

export async function addAgentTool(input: {
  agentId: string
  type: "mcp-server" | "function" | "agent"
  referenceId: string
  required?: boolean
  config?: unknown
}) {
  const [result] = await db.insert(agentTool).values(input).returning()
  if (!result) throw new Error("Failed to insert agent tool row")
  return result
}

export async function updateAgent(
  id: string,
  fields: {
    prompt?: string
    modelId?: string | null
    name?: string
    description?: string
  },
) {
  // updatedAt is handled automatically by schema $onUpdate
  const [updated] = await db
    .update(agent)
    .set(fields)
    .where(eq(agent.id, id))
    .returning()
  return updated ?? null
}

export async function removeAgentTool(toolId: string) {
  const [deleted] = await db
    .delete(agentTool)
    .where(eq(agentTool.id, toolId))
    .returning()
  return deleted ?? null
}
