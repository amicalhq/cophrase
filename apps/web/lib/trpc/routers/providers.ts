import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { orgProcedure, router } from "@/lib/trpc/init"
import {
  providerTypeEnum,
  modelTypeEnum,
  type ProviderType,
  type ModelType,
} from "@workspace/db"
import { encrypt, decrypt } from "@workspace/db/crypto"
import {
  getProvidersByOrg,
  createProvider,
  updateProvider,
  deleteProvider,
  getProviderById,
} from "@/lib/data/providers"
import { createModels, getDefaultsForOrg } from "@workspace/db/queries/models"
import { isSupportedProvider } from "@/lib/ai/registry"
import { testProviderConnection } from "@/lib/ai/test-connection"

const validProviderTypes = providerTypeEnum.enumValues as readonly string[]
const validModelTypes = modelTypeEnum.enumValues as readonly string[]

export const providersRouter = router({
  list: orgProcedure.query(async ({ input }) => {
    return getProvidersByOrg(input.orgId)
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        providerType: z.string(),
        apiKey: z.string().min(1, "apiKey is required"),
        baseURL: z.string().optional(),
        models: z
          .array(
            z.object({
              modelId: z.string(),
              modelType: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, name, providerType, apiKey, baseURL, models } = input

      if (!validProviderTypes.includes(providerType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid provider type",
        })
      }

      if (!isSupportedProvider(providerType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported provider type",
        })
      }

      try {
        const apiKeyEnc = encrypt(apiKey)
        const provider = await createProvider({
          organizationId: orgId,
          name: name.trim(),
          providerType: providerType as ProviderType,
          apiKeyEnc,
          baseUrl: baseURL,
        })

        let createdModels: {
          id: string
          modelId: string
          modelType: string
          isDefault: boolean
        }[] = []

        if (models && models.length > 0) {
          const invalidType = models.find(
            (m) => !validModelTypes.includes(m.modelType)
          )
          if (invalidType) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid model type: ${invalidType.modelType}`,
            })
          }

          const existingDefaults = await getDefaultsForOrg(orgId)
          const typesWithDefaults = new Set(
            existingDefaults.map((d) => d.modelType)
          )

          const modelsByType = new Map<string, typeof models>()
          for (const m of models) {
            const group = modelsByType.get(m.modelType) ?? []
            group.push(m)
            modelsByType.set(m.modelType, group)
          }

          const modelsToInsert = models.map((m) => {
            const typeGroup = modelsByType.get(m.modelType)!
            const isFirstOfType =
              typeGroup[0] === m &&
              !typesWithDefaults.has(m.modelType as ModelType)
            return {
              organizationId: orgId,
              providerId: provider.id,
              modelId: m.modelId,
              modelType: m.modelType as ModelType,
              isDefault: isFirstOfType,
            }
          })

          createdModels = await createModels(modelsToInsert)
        }

        return { provider, models: createdModels }
      } catch (error: any) {
        if (error instanceof TRPCError) throw error
        if (error?.code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A provider with this name already exists in this organization",
          })
        }
        throw error
      }
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        apiKey: z.string().optional(),
        baseURL: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, id, name, apiKey, baseURL } = input

      try {
        const updateData: {
          name?: string
          apiKeyEnc?: string
          baseUrl?: string | null
        } = {}
        if (name?.trim()) updateData.name = name.trim()
        if (apiKey) updateData.apiKeyEnc = encrypt(apiKey)
        if (baseURL !== undefined) updateData.baseUrl = baseURL

        const updated = await updateProvider(id, orgId, updateData)
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND" })
        }

        return updated
      } catch (error: any) {
        if (error instanceof TRPCError) throw error
        if (error?.code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A provider with this name already exists",
          })
        }
        throw error
      }
    }),

  delete: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, id } = input

      const deleted = await deleteProvider(id, orgId)
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      return { success: true }
    }),

  test: orgProcedure
    .input(
      z.object({
        providerType: z.string().optional(),
        apiKey: z.string().optional(),
        baseURL: z.string().optional(),
        providerId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, providerType, apiKey, baseURL, providerId } = input

      let resolvedType: ProviderType
      let resolvedKey: string
      let resolvedBaseURL: string | undefined = baseURL

      try {
        if (providerId) {
          const provider = await getProviderById(providerId, orgId)
          if (!provider) {
            return { success: false, error: "Provider not found" }
          }
          resolvedType = provider.providerType
          resolvedKey = apiKey?.trim() || decrypt(provider.apiKeyEnc)
          resolvedBaseURL = baseURL ?? provider.baseUrl ?? undefined
        } else {
          if (!providerType || !isSupportedProvider(providerType)) {
            return { success: false, error: "Invalid provider type" }
          }
          if (!apiKey?.trim()) {
            return { success: false, error: "apiKey is required" }
          }
          resolvedType = providerType as ProviderType
          resolvedKey = apiKey.trim()
        }

        const result = await testProviderConnection({
          providerType: resolvedType,
          apiKey: resolvedKey,
          baseURL: resolvedBaseURL,
        })

        return result
      } catch (err) {
        console.error("Provider test connection error:", err)
        return { success: false, error: "Internal server error" }
      }
    }),
})
