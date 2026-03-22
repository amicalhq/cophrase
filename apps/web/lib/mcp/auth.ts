import { verifyAccessToken } from "better-auth/oauth2"
import type { McpContext } from "@/lib/mcp/types"

const AUTH_BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

export async function verifyMcpToken(
  authorizationHeader: string | null,
): Promise<McpContext | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null
  const token = authorizationHeader.slice(7)

  try {
    const payload = await verifyAccessToken(token, {
      jwksUrl: `${AUTH_BASE}/api/auth/jwks`,
      verifyOptions: {
        issuer: `${AUTH_BASE}/api/auth`,
        audience: `${AUTH_BASE}/mcp`,
      },
      scopes: ["cophrase"],
    })

    if (!payload?.sub) return null
    return { userId: payload.sub }
  } catch {
    return null
  }
}
