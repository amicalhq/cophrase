import { verifyAccessToken } from "better-auth/oauth2"
import type { McpContext } from "@/lib/mcp/types"

const PUBLIC_AUTH_BASE =
  process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const INTERNAL_AUTH_BASE =
  process.env.BETTER_AUTH_INTERNAL_URL ?? PUBLIC_AUTH_BASE

export async function verifyMcpToken(
  authorizationHeader: string | null,
): Promise<McpContext | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null
  const token = authorizationHeader.slice(7)

  try {
    const payload = await verifyAccessToken(token, {
      jwksUrl: `${INTERNAL_AUTH_BASE}/api/auth/jwks`,
      verifyOptions: {
        issuer: `${PUBLIC_AUTH_BASE}/api/auth`,
        audience: `${PUBLIC_AUTH_BASE}/mcp`,
      },
      scopes: ["cophrase"],
    })

    if (!payload?.sub) return null
    return { userId: payload.sub }
  } catch {
    return null
  }
}
