import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "../index"
import { aiProvider } from "../schema/providers"
import { aiModel } from "../schema/models"
import type { ProviderType } from "../schema/enums"

export async function getProvidersByOrg(organizationId: string) {
  return await db
    .select({
      id: aiProvider.id,
      name: aiProvider.name,
      providerType: aiProvider.providerType,
      baseUrl: aiProvider.baseUrl,
      createdAt: aiProvider.createdAt,
      updatedAt: aiProvider.updatedAt,
      modelCount: sql<number>`count(${aiModel.id})::int`,
    })
    .from(aiProvider)
    .leftJoin(aiModel, eq(aiProvider.id, aiModel.providerId))
    .where(eq(aiProvider.organizationId, organizationId))
    .groupBy(aiProvider.id)
    .orderBy(desc(aiProvider.createdAt))
}

export async function getProviderById(id: string, organizationId: string) {
  const [result] = await db
    .select({
      id: aiProvider.id,
      name: aiProvider.name,
      providerType: aiProvider.providerType,
      apiKeyEnc: aiProvider.apiKeyEnc,
      baseUrl: aiProvider.baseUrl,
      organizationId: aiProvider.organizationId,
      createdAt: aiProvider.createdAt,
    })
    .from(aiProvider)
    .where(
      and(eq(aiProvider.id, id), eq(aiProvider.organizationId, organizationId)),
    )
  return result ?? null
}

export async function createProvider(input: {
  organizationId: string
  name: string
  providerType: ProviderType
  apiKeyEnc: string
  baseUrl?: string
}) {
  const [created] = await db
    .insert(aiProvider)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      providerType: input.providerType,
      apiKeyEnc: input.apiKeyEnc,
      baseUrl: input.baseUrl ?? null,
    })
    .returning({
      id: aiProvider.id,
      name: aiProvider.name,
      providerType: aiProvider.providerType,
    })
  if (!created) throw new Error("Failed to insert provider row")
  return created
}

export async function updateProvider(
  id: string,
  organizationId: string,
  input: { name?: string; apiKeyEnc?: string; baseUrl?: string | null },
) {
  const [updated] = await db
    .update(aiProvider)
    .set(input)
    .where(
      and(eq(aiProvider.id, id), eq(aiProvider.organizationId, organizationId)),
    )
    .returning({ id: aiProvider.id })
  return updated ?? null
}

export async function deleteProvider(id: string, organizationId: string) {
  const [deleted] = await db
    .delete(aiProvider)
    .where(
      and(eq(aiProvider.id, id), eq(aiProvider.organizationId, organizationId)),
    )
    .returning({ id: aiProvider.id })
  return deleted ?? null
}
