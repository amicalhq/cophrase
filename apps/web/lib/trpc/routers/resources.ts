import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { orgProcedure, router } from "@/lib/trpc/init"
import { resourceTypeEnum, resourceCategoryEnum } from "@workspace/db"
import {
  getResourcesByProject,
  getResourceById,
  getResourceContent,
  createResource,
  updateResource,
  deleteResource,
  getProjectStorageUsage,
} from "@/lib/data/resources"
import { getProjectByIdAndOrg } from "@/lib/data/projects"
import {
  generatePresignedGetUrl,
  generatePresignedUploadUrl,
  deleteS3Object,
} from "@/lib/s3"
import {
  MAX_TITLE_LENGTH,
  MAX_FILE_SIZE,
  MAX_PROJECT_STORAGE,
  ALLOWED_MIME_TYPES,
} from "@/lib/resource-constants"
import type { ResourceType, ResourceCategory } from "@workspace/db"

const validTypes = resourceTypeEnum.enumValues as readonly string[]
const validCategories = resourceCategoryEnum.enumValues as readonly string[]

export const resourcesRouter = router({
  list: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        type: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { orgId, projectId, type, category, search } = input

      const project = await getProjectByIdAndOrg(projectId, orgId)
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        })
      }

      const resources = await getResourcesByProject(projectId, orgId, {
        type:
          type && validTypes.includes(type)
            ? (type as ResourceType)
            : undefined,
        category:
          category && validCategories.includes(category)
            ? (category as ResourceCategory)
            : undefined,
        search,
      })

      const resourcesWithUrls = await Promise.all(
        resources.map(async (r) => {
          if (r.type === "file" && r.fileUrl) {
            const presignedUrl = await generatePresignedGetUrl(r.fileUrl)
            return { ...r, presignedUrl }
          }
          return r
        })
      )

      return resourcesWithUrls
    }),

  get: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { orgId, id, projectId } = input

      const resourceData = await getResourceById(id, projectId, orgId)
      if (!resourceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
      }

      const response: Record<string, unknown> = { ...resourceData }

      if (resourceData.type === "text") {
        const content = await getResourceContent(id)
        response.content = content?.content ?? null
      }

      if (resourceData.type === "file" && resourceData.fileUrl) {
        response.presignedUrl = await generatePresignedGetUrl(
          resourceData.fileUrl
        )
      }

      return response
    }),

  create: orgProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        title: z
          .string()
          .min(1, "Title is required")
          .max(
            MAX_TITLE_LENGTH,
            `Title must be ${MAX_TITLE_LENGTH} characters or less`
          )
          .transform((s) => s.trim()),
        type: z.enum(resourceTypeEnum.enumValues),
        category: z.enum(resourceCategoryEnum.enumValues),
        linkUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileMimeType: z.string().optional(),
        fileSize: z.number().optional(),
        content: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const {
        orgId,
        projectId,
        title,
        type,
        category,
        linkUrl,
        fileName,
        fileMimeType,
        fileSize,
        content,
      } = input

      // Type-specific validation
      if (type === "link") {
        if (!linkUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "URL is required for link resources",
          })
        }
        try {
          const url = new URL(linkUrl)
          if (!["http:", "https:"].includes(url.protocol)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "URL must be http or https",
            })
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid URL",
          })
        }
      }

      if (type === "text" && !content) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Content is required for text resources",
        })
      }

      if (type === "file") {
        if (!fileName || !fileMimeType || !fileSize) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "fileName, fileMimeType, and fileSize are required for file resources",
          })
        }
        if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(fileMimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "File type not allowed. Accepted: PNG, JPEG, SVG, WebP, GIF, PDF",
          })
        }
        if (fileSize > MAX_FILE_SIZE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File size must be 10MB or less",
          })
        }
      }

      const project = await getProjectByIdAndOrg(projectId, orgId)
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        })
      }

      // Check project storage limit for file resources
      if (type === "file" && fileSize) {
        const currentUsage = await getProjectStorageUsage(projectId)
        if (currentUsage + fileSize > MAX_PROJECT_STORAGE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project storage limit exceeded (500MB max)",
          })
        }
      }

      const created = await createResource({
        projectId,
        organizationId: project.organizationId,
        createdBy: ctx.session.user.id,
        title,
        type,
        category,
        linkUrl: type === "link" ? linkUrl : undefined,
        content: type === "text" ? content : undefined,
      })

      const response: Record<string, unknown> = { ...created }

      // Generate presigned upload URL for file resources
      if (type === "file" && fileName && fileMimeType) {
        const { url, key } = await generatePresignedUploadUrl(
          project.organizationId,
          projectId,
          created.id,
          fileName,
          fileMimeType
        )
        // Update the resource with file metadata
        await updateResource(created.id, projectId, project.organizationId, {
          fileUrl: key,
          fileName,
          fileMimeType,
          fileSize,
        })
        response.uploadUrl = url
        response.fileUrl = key
        response.fileName = fileName
        response.fileMimeType = fileMimeType
        response.fileSize = fileSize
      }

      return response
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
        title: z
          .string()
          .max(
            MAX_TITLE_LENGTH,
            `Title must be ${MAX_TITLE_LENGTH} characters or less`
          )
          .optional(),
        category: z.enum(resourceCategoryEnum.enumValues).optional(),
        linkUrl: z.string().optional(),
        content: z.record(z.string(), z.unknown()).optional(),
        fileName: z.string().optional(),
        fileMimeType: z.string().optional(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        orgId,
        id,
        projectId,
        title,
        category,
        linkUrl,
        content,
        fileName,
        fileMimeType,
        fileSize,
      } = input

      const existing = await getResourceById(id, projectId, orgId)
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
      }

      const updateData: Record<string, unknown> = {}
      if (title !== undefined) updateData.title = title.trim()
      if (category) updateData.category = category
      if (content !== undefined) updateData.content = content

      if (existing.type === "link" && linkUrl !== undefined) {
        try {
          const url = new URL(linkUrl)
          if (!["http:", "https:"].includes(url.protocol)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "URL must be http or https",
            })
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid URL",
          })
        }
        updateData.linkUrl = linkUrl
      }

      const response: Record<string, unknown> = { id }
      let oldFileUrl: string | null = null

      // Handle file replacement — generate new URL but keep old file until upload confirms
      if (existing.type === "file" && fileName && fileMimeType && fileSize) {
        if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(fileMimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File type not allowed",
          })
        }
        if (fileSize > MAX_FILE_SIZE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File size must be 10MB or less",
          })
        }

        oldFileUrl = existing.fileUrl

        // Generate new presigned URL
        const { url, key } = await generatePresignedUploadUrl(
          existing.organizationId,
          projectId,
          id,
          fileName,
          fileMimeType
        )
        updateData.fileUrl = key
        updateData.fileName = fileName
        updateData.fileMimeType = fileMimeType
        updateData.fileSize = fileSize
        response.uploadUrl = url
      }

      await updateResource(id, projectId, orgId, updateData)

      // Delete old S3 object after DB update succeeds
      if (oldFileUrl) {
        try {
          await deleteS3Object(oldFileUrl)
        } catch (error) {
          console.error("Failed to delete old S3 object:", error)
          // Non-fatal: old object becomes orphaned but new one is in place
        }
      }

      return response
    }),

  delete: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, id, projectId } = input

      const deleted = await deleteResource(id, projectId, orgId)
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
      }

      // Delete S3 object for file resources
      if (deleted.type === "file" && deleted.fileUrl) {
        try {
          await deleteS3Object(deleted.fileUrl)
        } catch (error) {
          console.error("Failed to delete S3 object:", error)
        }
      }

      return { success: true }
    }),
})
