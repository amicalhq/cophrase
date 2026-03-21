import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { authedProcedure, orgProcedure, router } from "@/lib/trpc/init"
import {
  getContentTypesByProject,
  getAppContentTypes,
  getStagesByContentType,
  getContentTypeById,
  getContentTypeWithStages,
  createContentTypeFromScratch,
  installContentType,
  updateContentType,
  deleteContentTypeIfUnused,
  forkContentType,
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  bindSubAgent,
  unbindSubAgent,
} from "@workspace/db/queries/content-types"
import { isOrgMember, getProjectByIdAndOrg } from "@/lib/data/projects"

// ---------------------------------------------------------------------------
// Auth helper — reused by mutation procedures that operate on a content type
// ---------------------------------------------------------------------------

async function authorizeContentType(id: string, userId: string) {
  const ct = await getContentTypeById(id)
  if (!ct) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Content type not found" })
  }
  if (ct.scope === "app") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot modify app-scoped content types",
    })
  }
  if (!ct.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  const isMember = await isOrgMember(userId, ct.organizationId)
  if (!isMember) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return ct
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const contentTypesRouter = router({
  // -----------------------------------------------------------------------
  // contentTypes.list — list content types for a project
  // -----------------------------------------------------------------------
  list: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getContentTypesByProject(input.projectId)
    }),

  // -----------------------------------------------------------------------
  // contentTypes.templates — list app-scoped templates (session-only)
  // -----------------------------------------------------------------------
  templates: authedProcedure.query(async () => {
    const templates = await getAppContentTypes()
    const templatesWithStages = await Promise.all(
      templates.map(async (t) => {
        const stages = await getStagesByContentType(t.id)
        return {
          ...t,
          stages: stages.map((s) => ({
            id: s.id,
            name: s.name,
            position: s.position,
          })),
        }
      }),
    )
    return templatesWithStages
  }),

  // -----------------------------------------------------------------------
  // contentTypes.get — get a single content type with stages
  // -----------------------------------------------------------------------
  get: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Allow reading app-scoped content types (no scope check for GET)
      const ct = await getContentTypeById(input.id)
      if (!ct) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content type not found" })
      }

      // For org-scoped content types, verify membership
      if (ct.organizationId) {
        const isMember = await isOrgMember(ctx.session.user.id, ct.organizationId)
        if (!isMember) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
      }

      const result = await getContentTypeWithStages(input.id)
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content type not found" })
      }
      return result
    }),

  // -----------------------------------------------------------------------
  // contentTypes.create — create from scratch
  // -----------------------------------------------------------------------
  create: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        format: z.enum(["rich_text", "plain_text", "image", "video", "deck"]),
        frontmatterSchema: z.record(z.string(), z.unknown()).optional(),
        stages: z.array(
          z.object({
            name: z.string().min(1),
            position: z.number(),
            optional: z.boolean().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      return createContentTypeFromScratch({
        projectId: input.projectId,
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        format: input.format,
        frontmatterSchema: input.frontmatterSchema,
        stages: input.stages,
      })
    }),

  // -----------------------------------------------------------------------
  // contentTypes.install — install a template into a project
  // -----------------------------------------------------------------------
  install: orgProcedure
    .input(
      z.object({
        templateId: z.string().min(1),
        projectId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const template = await getContentTypeById(input.templateId)
      if (!template || template.scope !== "app") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" })
      }

      const project = await getProjectByIdAndOrg(input.projectId, input.orgId)
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })
      }

      return installContentType({
        templateId: input.templateId,
        projectId: input.projectId,
        orgId: input.orgId,
      })
    }),

  // -----------------------------------------------------------------------
  // contentTypes.update — update name, description, or frontmatterSchema
  // -----------------------------------------------------------------------
  update: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        frontmatterSchema: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.id, ctx.session.user.id)
      const { id, ...fields } = input
      return updateContentType(id, fields)
    }),

  // -----------------------------------------------------------------------
  // contentTypes.delete — delete if unused
  // -----------------------------------------------------------------------
  delete: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.id, ctx.session.user.id)
      const result = await deleteContentTypeIfUnused(input.id)
      if (result && "error" in result && result.error === "in_use") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Content type is in use and cannot be deleted",
        })
      }
      return result
    }),

  // -----------------------------------------------------------------------
  // contentTypes.fork — fork a content type
  // -----------------------------------------------------------------------
  fork: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ct = await authorizeContentType(input.id, ctx.session.user.id)
      if (!ct.organizationId || !ct.projectId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot fork app-scoped content type",
        })
      }
      return forkContentType({
        contentTypeId: input.id,
        projectId: ct.projectId,
        orgId: ct.organizationId,
      })
    }),

  // -----------------------------------------------------------------------
  // contentTypes.addStage
  // -----------------------------------------------------------------------
  addStage: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        name: z.string().min(1),
        position: z.number().optional(),
        optional: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      return addStage({
        contentTypeId: input.contentTypeId,
        name: input.name,
        position: input.position,
        optional: input.optional,
      })
    }),

  // -----------------------------------------------------------------------
  // contentTypes.updateStage
  // -----------------------------------------------------------------------
  updateStage: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        stageId: z.string().min(1),
        name: z.string().min(1).optional(),
        optional: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      const { stageId, ...rest } = input
      const { contentTypeId: _, ...fields } = rest
      return updateStage(stageId, fields)
    }),

  // -----------------------------------------------------------------------
  // contentTypes.deleteStage
  // -----------------------------------------------------------------------
  deleteStage: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        stageId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      return deleteStage(input.stageId)
    }),

  // -----------------------------------------------------------------------
  // contentTypes.reorderStages
  // -----------------------------------------------------------------------
  reorderStages: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        stageIds: z.array(z.string().min(1)),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      const result = await reorderStages(input.contentTypeId, input.stageIds)
      if ("error" in result && result.error === "stage_id_mismatch") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stage IDs do not match existing stages",
        })
      }
      return result
    }),

  // -----------------------------------------------------------------------
  // contentTypes.bindSubAgent
  // -----------------------------------------------------------------------
  bindSubAgent: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        stageId: z.string().min(1),
        agentId: z.string().min(1),
        executionOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      return bindSubAgent({
        stageId: input.stageId,
        agentId: input.agentId,
        executionOrder: input.executionOrder,
      })
    }),

  // -----------------------------------------------------------------------
  // contentTypes.unbindSubAgent
  // -----------------------------------------------------------------------
  unbindSubAgent: authedProcedure
    .input(
      z.object({
        contentTypeId: z.string().min(1),
        subAgentId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await authorizeContentType(input.contentTypeId, ctx.session.user.id)
      return unbindSubAgent(input.subAgentId)
    }),
})
