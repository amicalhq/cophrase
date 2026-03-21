import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { orgProcedure, router } from "@/lib/trpc/init"
import { modelTypeEnum, type ModelType } from "@workspace/db"
import {
  createModels,
  deleteModels,
  deleteModelById,
  setDefaultModel,
  promoteNextDefault,
} from "@/lib/data/models"
import { isSupportedProvider } from "@/lib/ai/registry"
import { getAvailableModels } from "@/lib/ai/available-models"

const validModelTypes = modelTypeEnum.enumValues as readonly string[]

export const modelsRouter = router({
  add: orgProcedure
    .input(
      z.object({
        add: z
          .array(
            z.object({
              providerId: z.string(),
              modelId: z.string(),
              modelType: z.string(),
            })
          )
          .optional(),
        remove: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, add, remove } = input

      let added: {
        id: string
        modelId: string
        modelType: string
        isDefault: boolean
      }[] = []
      let removed: { id: string; modelType: string; isDefault: boolean }[] = []

      if (remove && remove.length > 0) {
        removed = await deleteModels(remove, orgId)

        for (const r of removed) {
          if (r.isDefault) {
            await promoteNextDefault(orgId, r.modelType as ModelType)
          }
        }
      }

      if (add && add.length > 0) {
        const invalidType = add.find((m) => !validModelTypes.includes(m.modelType))
        if (invalidType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid model type: ${invalidType.modelType}`,
          })
        }

        added = await createModels(
          add.map((m) => ({
            organizationId: orgId,
            providerId: m.providerId,
            modelId: m.modelId,
            modelType: m.modelType as ModelType,
          }))
        )
      }

      return { added, removed }
    }),

  remove: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { orgId, id } = input

      const deleted = await deleteModelById(id, orgId)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      if (deleted.isDefault) {
        await promoteNextDefault(deleted.organizationId, deleted.modelType)
      }

      return { success: true }
    }),

  setDefault: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { orgId, id } = input

      const updated = await setDefaultModel(id, orgId)
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      return updated
    }),

  available: orgProcedure
    .input(z.object({ providerType: z.string() }))
    .query(async ({ input }) => {
      const { providerType } = input

      if (!isSupportedProvider(providerType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Valid providerType is required",
        })
      }

      const models = await getAvailableModels(providerType)

      // Sort by release date descending (newest first)
      models.sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0
        if (!a.releaseDate) return 1
        if (!b.releaseDate) return -1
        return b.releaseDate.localeCompare(a.releaseDate)
      })

      return models
    }),
})
