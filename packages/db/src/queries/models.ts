import { eq, and, desc, inArray } from "drizzle-orm"
import { db } from "../index"
import { aiModel } from "../schema/models"
import { aiProvider } from "../schema/providers"
import type { ModelType } from "../schema/enums"

export async function getModelsByOrg(organizationId: string) {
  return await db
    .select({
      id: aiModel.id,
      modelId: aiModel.modelId,
      modelType: aiModel.modelType,
      isDefault: aiModel.isDefault,
      createdAt: aiModel.createdAt,
      providerId: aiModel.providerId,
      providerName: aiProvider.name,
      providerType: aiProvider.providerType,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(eq(aiModel.organizationId, organizationId))
    .orderBy(desc(aiModel.createdAt))
}

export async function createModels(
  models: Array<{
    organizationId: string
    providerId: string
    modelId: string
    modelType: ModelType
    isDefault?: boolean
  }>,
) {
  if (models.length === 0) return []
  return await db
    .insert(aiModel)
    .values(
      models.map((m) => ({
        organizationId: m.organizationId,
        providerId: m.providerId,
        modelId: m.modelId,
        modelType: m.modelType,
        isDefault: m.isDefault ?? false,
      })),
    )
    .returning({
      id: aiModel.id,
      modelId: aiModel.modelId,
      modelType: aiModel.modelType,
      isDefault: aiModel.isDefault,
    })
}

export async function deleteModels(ids: string[], organizationId: string) {
  if (ids.length === 0) return []
  return await db
    .delete(aiModel)
    .where(
      and(inArray(aiModel.id, ids), eq(aiModel.organizationId, organizationId)),
    )
    .returning({
      id: aiModel.id,
      modelType: aiModel.modelType,
      isDefault: aiModel.isDefault,
    })
}

export async function deleteModelById(id: string, organizationId: string) {
  const [deleted] = await db
    .delete(aiModel)
    .where(
      and(eq(aiModel.id, id), eq(aiModel.organizationId, organizationId)),
    )
    .returning({
      id: aiModel.id,
      modelType: aiModel.modelType,
      isDefault: aiModel.isDefault,
      organizationId: aiModel.organizationId,
    })
  return deleted ?? null
}

export async function setDefaultModel(
  id: string,
  organizationId: string,
) {
  return await db.transaction(async (tx) => {
    // First, get the model to find its type
    const [model] = await tx
      .select({ modelType: aiModel.modelType })
      .from(aiModel)
      .where(
        and(eq(aiModel.id, id), eq(aiModel.organizationId, organizationId)),
      )
    if (!model) return null

    // Unset existing default for this type
    await tx
      .update(aiModel)
      .set({ isDefault: false })
      .where(
        and(
          eq(aiModel.organizationId, organizationId),
          eq(aiModel.modelType, model.modelType),
          eq(aiModel.isDefault, true),
        ),
      )

    // Set new default
    const [updated] = await tx
      .update(aiModel)
      .set({ isDefault: true })
      .where(
        and(eq(aiModel.id, id), eq(aiModel.organizationId, organizationId)),
      )
      .returning({ id: aiModel.id, modelType: aiModel.modelType })
    return updated ?? null
  })
}

export async function promoteNextDefault(
  organizationId: string,
  modelType: ModelType,
) {
  // Find the most recently created model of this type
  const [next] = await db
    .select({ id: aiModel.id })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.organizationId, organizationId),
        eq(aiModel.modelType, modelType),
      ),
    )
    .orderBy(desc(aiModel.createdAt))
    .limit(1)

  if (!next) return null

  const [promoted] = await db
    .update(aiModel)
    .set({ isDefault: true })
    .where(eq(aiModel.id, next.id))
    .returning({ id: aiModel.id })
  return promoted ?? null
}

export async function getDefaultsForOrg(organizationId: string) {
  return await db
    .select({
      modelType: aiModel.modelType,
      modelId: aiModel.id,
    })
    .from(aiModel)
    .where(
      and(
        eq(aiModel.organizationId, organizationId),
        eq(aiModel.isDefault, true),
      ),
    )
}
