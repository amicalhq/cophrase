import { sleep } from "workflow"
import { fetchRegistryPage, upsertBatch } from "./steps"

const MAX_PAGES = 100

export async function syncMcpCatalog() {
  "use workflow"

  while (true) {
    try {
      let cursor: string | null = null
      let pageCount = 0

      do {
        const page = await fetchRegistryPage(cursor)
        await upsertBatch(page.servers)
        cursor = page.nextCursor
        pageCount++
      } while (cursor && pageCount < MAX_PAGES)
    } catch {
      // Sync cycle failed — log is handled by Workflow DevKit.
      // Continue to sleep and retry next cycle.
    }

    await sleep("1h")
  }
}
