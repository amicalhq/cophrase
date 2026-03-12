import { FatalError, RetryableError } from "workflow"
import { db, sql } from "@workspace/db"
import { mcpCatalog } from "@workspace/db/schema"

const DEFAULT_REGISTRY_URL =
  "https://registry.modelcontextprotocol.io/v0.1/servers"

interface RegistryServer {
  name: string
  title?: string
  description?: string
  version?: string
  websiteUrl?: string
  repository?: {
    url?: string
    source?: string
  }
  icons?: { src: string; mimeType?: string; sizes?: string[] }[]
  remotes?: { type: string; url: string }[]
  packages?: {
    registryType: string
    identifier: string
    version?: string
    transport: { type: string; url?: string }
    environmentVariables?: {
      name: string
      description?: string
      isRequired?: boolean
      isSecret?: boolean
      format?: string
    }[]
  }[]
}

interface RegistryEntry {
  server: RegistryServer
  _meta?: Record<string, Record<string, unknown>>
}

interface FetchPageResult {
  servers: RegistryServer[]
  nextCursor: string | null
}

export async function fetchRegistryPage(
  cursor: string | null
): Promise<FetchPageResult> {
  "use step"

  const baseUrl = process.env.MCP_REGISTRY_BASE_URL || DEFAULT_REGISTRY_URL
  const params = new URLSearchParams({ version: "latest", limit: "100" })
  if (cursor) params.set("cursor", cursor)

  const url = `${baseUrl}?${params.toString()}`
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  if (res.status >= 400 && res.status < 500) {
    throw new FatalError(`Registry returned ${res.status}: ${await res.text()}`)
  }
  if (!res.ok) {
    throw new RetryableError(`Registry returned ${res.status}`, {
      retryAfter: "30s",
    })
  }

  const data = await res.json()
  const entries: RegistryEntry[] = data.servers || []

  const servers = entries
    .filter((entry) => {
      const official =
        entry._meta?.["io.modelcontextprotocol.registry/official"]
      return !official || official.status === "active"
    })
    .map((entry) => entry.server)

  return {
    servers,
    nextCursor: data.metadata?.nextCursor || null,
  }
}

export async function upsertBatch(servers: RegistryServer[]): Promise<void> {
  "use step"

  if (servers.length === 0) return

  const now = new Date()

  for (const server of servers) {
    await db
      .insert(mcpCatalog)
      .values({
        name: server.name,
        source: "mcp-official",
        title: server.title ?? null,
        description: server.description ?? null,
        version: server.version ?? null,
        websiteUrl: server.websiteUrl ?? null,
        repositoryUrl: server.repository?.url ?? null,
        repositorySource: server.repository?.source ?? null,
        icons: server.icons ?? null,
        remotes: server.remotes ?? null,
        packages: server.packages ?? null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: mcpCatalog.name,
        set: {
          source: "mcp-official",
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          version: sql`excluded.version`,
          websiteUrl: sql`excluded.website_url`,
          repositoryUrl: sql`excluded.repository_url`,
          repositorySource: sql`excluded.repository_source`,
          icons: sql`excluded.icons`,
          remotes: sql`excluded.remotes`,
          packages: sql`excluded.packages`,
          updatedAt: now,
          lastSeenAt: now,
        },
      })
  }
}
