import { eq, and, or, lt, desc } from "drizzle-orm"
import { db } from "../index"
import { harnessMessage } from "../schema/harness-messages"

export async function getHarnessMessages(
  contentId: string,
  options: { cursor?: string; limit?: number } = {},
) {
  const limit = options.limit ?? 20

  if (options.cursor) {
    // Load the cursor message to get its createdAt for composite ordering
    const [cursorMsg] = await db
      .select({ createdAt: harnessMessage.createdAt, id: harnessMessage.id })
      .from(harnessMessage)
      .where(eq(harnessMessage.id, options.cursor))

    if (!cursorMsg) {
      return { messages: [], nextCursor: null }
    }

    // Composite cursor: handles timestamp ties by also comparing IDs
    const messages = await db
      .select()
      .from(harnessMessage)
      .where(
        and(
          eq(harnessMessage.contentId, contentId),
          or(
            lt(harnessMessage.createdAt, cursorMsg.createdAt),
            and(
              eq(harnessMessage.createdAt, cursorMsg.createdAt),
              lt(harnessMessage.id, cursorMsg.id),
            ),
          ),
        ),
      )
      .orderBy(desc(harnessMessage.createdAt), desc(harnessMessage.id))
      .limit(limit + 1)

    const hasMore = messages.length > limit
    const page = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? page[page.length - 1]!.id : null

    return { messages: page, nextCursor }
  }

  // No cursor — load the latest N messages
  const messages = await db
    .select()
    .from(harnessMessage)
    .where(eq(harnessMessage.contentId, contentId))
    .orderBy(desc(harnessMessage.createdAt), desc(harnessMessage.id))
    .limit(limit + 1)

  const hasMore = messages.length > limit
  const page = hasMore ? messages.slice(0, limit) : messages
  const nextCursor = hasMore ? page[page.length - 1]!.id : null

  return { messages: page, nextCursor }
}

export async function saveHarnessMessages(
  messages: Array<{
    id?: string
    organizationId: string
    contentId: string
    role: "user" | "assistant" | "system" | "tool"
    parts: unknown
    metadata?: unknown
    modelRecordId?: string | null
    providerRecordId?: string | null
    modelProviderType?: string | null
    modelName?: string | null
  }>,
) {
  if (messages.length === 0) return []
  return await db.insert(harnessMessage).values(messages).returning()
}

export async function hasHarnessMessages(contentId: string) {
  const [result] = await db
    .select({ id: harnessMessage.id })
    .from(harnessMessage)
    .where(eq(harnessMessage.contentId, contentId))
    .limit(1)
  return !!result
}
