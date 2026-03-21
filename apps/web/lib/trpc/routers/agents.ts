import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { authedProcedure, router } from "@/lib/trpc/init"
import {
  getAgentById,
  updateAgent,
  getAgentTools,
  addAgentTool,
  removeAgentTool,
} from "@workspace/db/queries/agents"
import { getAgentRunById } from "@workspace/db/queries/agent-runs"
import { getArtifactsByRun } from "@workspace/db/queries/artifacts"
import { isOrgMember } from "@/lib/data/projects"

export const agentsRouter = router({
  // -----------------------------------------------------------------------
  // agents.update — update an agent's prompt, modelId, name, or description
  // -----------------------------------------------------------------------
  update: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        prompt: z.string().optional(),
        modelId: z.string().nullable().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input

      const agent = await getAgentById(id)
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" })
      }
      if (!agent.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify app-scoped agent",
        })
      }

      const isMember = await isOrgMember(ctx.session.user.id, agent.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const updated = await updateAgent(id, fields)
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" })
      }

      return updated
    }),

  // -----------------------------------------------------------------------
  // agents.listTools — list tools configured for an agent
  // -----------------------------------------------------------------------
  listTools: authedProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { agentId } = input

      const agent = await getAgentById(agentId)
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" })
      }

      if (agent.organizationId) {
        const isMember = await isOrgMember(ctx.session.user.id, agent.organizationId)
        if (!isMember) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
      }

      return getAgentTools(agentId)
    }),

  // -----------------------------------------------------------------------
  // agents.addTool — add a tool to an agent
  // -----------------------------------------------------------------------
  addTool: authedProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        type: z.enum(["mcp-server", "function", "agent"]),
        referenceId: z.string().min(1),
        required: z.boolean().optional(),
        config: z.unknown().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { agentId, type, referenceId, required, config } = input

      const agent = await getAgentById(agentId)
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" })
      }
      if (!agent.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify app-scoped agent",
        })
      }

      const isMember = await isOrgMember(ctx.session.user.id, agent.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      return addAgentTool({ agentId, type, referenceId, required, config })
    }),

  // -----------------------------------------------------------------------
  // agents.removeTool — remove a tool from an agent
  // -----------------------------------------------------------------------
  removeTool: authedProcedure
    .input(
      z.object({
        agentId: z.string().min(1),
        toolId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { agentId, toolId } = input

      const agent = await getAgentById(agentId)
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" })
      }
      if (!agent.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify app-scoped agent",
        })
      }

      const isMember = await isOrgMember(ctx.session.user.id, agent.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const deleted = await removeAgentTool(toolId)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tool not found" })
      }

      return deleted
    }),

  // -----------------------------------------------------------------------
  // agents.getRun — get an agent run by ID
  // -----------------------------------------------------------------------
  getRun: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { runId } = input

      const agentRun = await getAgentRunById(runId)
      if (!agentRun) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent run not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, agentRun.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      return {
        id: agentRun.id,
        status: agentRun.status,
        agentId: agentRun.agentId,
        organizationId: agentRun.organizationId,
        projectId: agentRun.projectId,
        contentId: agentRun.contentId,
        executionMode: agentRun.executionMode,
        error: agentRun.error,
        createdAt: agentRun.createdAt,
        startedAt: agentRun.startedAt,
        completedAt: agentRun.completedAt,
      }
    }),

  // -----------------------------------------------------------------------
  // agents.getRunArtifacts — get artifacts for an agent run
  // -----------------------------------------------------------------------
  getRunArtifacts: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { runId } = input

      const agentRun = await getAgentRunById(runId)
      if (!agentRun) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent run not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, agentRun.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const artifacts = await getArtifactsByRun(runId)
      return { artifacts }
    }),

  // -----------------------------------------------------------------------
  // agents.approveRun — approve a run (deferred to post-v1)
  // -----------------------------------------------------------------------
  approveRun: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Approval workflow is deferred to post-v1",
      })
    }),

  // -----------------------------------------------------------------------
  // agents.messageRun — send a message to a run (deferred to post-v1)
  // -----------------------------------------------------------------------
  messageRun: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Multi-turn messaging is deferred to post-v1",
      })
    }),
})
