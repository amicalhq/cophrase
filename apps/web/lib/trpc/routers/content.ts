import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { authedProcedure, orgProcedure, router } from "@/lib/trpc/init"
import {
  getContentByProject,
  createContent,
  deleteContentBulk,
  getContentById,
  deleteContent,
} from "@/lib/data/content"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"
import { getContentByIdOnly, getContentFrontmatter, updateContentFrontmatter } from "@workspace/db/queries/content"
import { getHarnessMessages } from "@workspace/db/queries/harness-messages"
import { getArtifactsSummaryByContent, getArtifactById } from "@workspace/db/queries/artifacts"
import { getStagesByContentType } from "@workspace/db/queries/content-types"
import { generateInitialSuggestions } from "@/lib/harness/suggestions"
import { db, eq, and } from "@workspace/db"
import { agentRun } from "@workspace/db/schema"

const MAX_TITLE_LENGTH = 200

export const contentRouter = router({
  // -----------------------------------------------------------------------
  // content.list — list content for a project
  // -----------------------------------------------------------------------
  list: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const { orgId, projectId } = input

      const project = await getProjectByIdAndOrg(projectId, orgId)
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })
      }

      return getContentByProject(projectId)
    }),

  // -----------------------------------------------------------------------
  // content.create — create content in a project
  // -----------------------------------------------------------------------
  create: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        title: z.string().max(MAX_TITLE_LENGTH).optional(),
        contentTypeId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { orgId, projectId, title, contentTypeId } = input
      const trimmedTitle = title?.trim() || "Untitled"

      const project = await getProjectByIdAndOrg(projectId, orgId)
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })
      }

      return createContent({
        projectId,
        organizationId: project.organizationId,
        createdBy: ctx.session.user.id,
        title: trimmedTitle,
        contentTypeId,
      })
    }),

  // -----------------------------------------------------------------------
  // content.bulkDelete — delete multiple content items
  // -----------------------------------------------------------------------
  bulkDelete: orgProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { ids, orgId } = input
      const deleted = await deleteContentBulk(ids, orgId)
      return { deleted: deleted.length }
    }),

  // -----------------------------------------------------------------------
  // content.delete — delete a single content item
  // -----------------------------------------------------------------------
  delete: orgProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
        projectId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { contentId, projectId, orgId } = input

      const existing = await getContentById(contentId, projectId)
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const deleted = await deleteContent(contentId, orgId)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      return { success: true }
    }),

  // -----------------------------------------------------------------------
  // content.messages — paginated messages for a content item
  // -----------------------------------------------------------------------
  messages: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { contentId, cursor } = input
      const limit = Math.min(input.limit ?? 20, 50)

      const contentRow = await getContentByIdOnly(contentId)
      if (!contentRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, contentRow.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const { messages, nextCursor } = await getHarnessMessages(contentId, {
        cursor,
        limit,
      })

      return { messages, nextCursor }
    }),

  // -----------------------------------------------------------------------
  // content.artifacts — list artifact summaries for a content item
  // -----------------------------------------------------------------------
  artifacts: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { contentId } = input

      const contentRow = await getContentByIdOnly(contentId)
      if (!contentRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, contentRow.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const artifacts = await getArtifactsSummaryByContent(contentId)

      // Group by type for the picker UI
      const grouped: Record<string, typeof artifacts> = {}
      for (const a of artifacts) {
        ;(grouped[a.type] ??= []).push(a)
      }

      return { artifacts, grouped }
    }),

  // -----------------------------------------------------------------------
  // content.artifact — get a single artifact by ID
  // -----------------------------------------------------------------------
  artifact: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
        artifactId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { contentId, artifactId } = input

      const contentRow = await getContentByIdOnly(contentId)
      if (!contentRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, contentRow.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const artifact = await getArtifactById(artifactId)
      if (
        !artifact ||
        artifact.contentId !== contentId ||
        artifact.organizationId !== contentRow.organizationId
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" })
      }

      return { artifact }
    }),

  // -----------------------------------------------------------------------
  // content.suggestions — initial suggestions for a content item
  // -----------------------------------------------------------------------
  suggestions: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { contentId } = input

      const content = await getContentByIdOnly(contentId)
      if (!content) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, content.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const stages = await getStagesByContentType(content.contentTypeId)
      const suggestions = generateInitialSuggestions(
        stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
        content.currentStageId,
      )

      return { suggestions }
    }),

  // -----------------------------------------------------------------------
  // content.getFrontmatter — get frontmatter for a content item
  // -----------------------------------------------------------------------
  getFrontmatter: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { contentId } = input

      const result = await getContentFrontmatter(contentId)
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" })
      }

      // Verify org membership
      const content = await getContentByIdOnly(contentId)
      if (content) {
        const isMember = await isOrgMember(ctx.session.user.id, content.organizationId)
        if (!isMember) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
      }

      return { frontmatter: result.frontmatter ?? {}, contentTypeId: result.contentTypeId }
    }),

  // -----------------------------------------------------------------------
  // content.updateFrontmatter — update frontmatter for a content item
  // -----------------------------------------------------------------------
  updateFrontmatter: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
        frontmatter: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { contentId, frontmatter } = input

      const content = await getContentByIdOnly(contentId)
      if (!content) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, content.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      return updateContentFrontmatter(contentId, frontmatter)
    }),

  // -----------------------------------------------------------------------
  // content.cancelChat — cancel running agent runs for a content item
  // -----------------------------------------------------------------------
  cancelChat: authedProcedure
    .input(
      z.object({
        contentId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { contentId } = input

      const contentRow = await getContentByIdOnly(contentId)
      if (!contentRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" })
      }

      const isMember = await isOrgMember(ctx.session.user.id, contentRow.organizationId)
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const cancelled = await db
        .update(agentRun)
        .set({ status: "cancelled" })
        .where(
          and(eq(agentRun.contentId, contentId), eq(agentRun.status, "running")),
        )
        .returning({ id: agentRun.id })

      return { cancelledRuns: cancelled.map((r) => r.id) }
    }),
})
