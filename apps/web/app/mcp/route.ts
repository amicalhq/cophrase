import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createMcpServer } from "@/lib/mcp/server"
import { verifyMcpToken } from "@/lib/mcp/auth"

const AUTH_BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const ALLOWED_ORIGIN = new URL(AUTH_BASE).origin

export async function POST(request: Request) {
  const ctx = await verifyMcpToken(request.headers.get("authorization"))
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${AUTH_BASE}/.well-known/oauth-protected-resource"`,
      },
    })
  }

  const server = createMcpServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: true,
    allowedOrigins: [ALLOWED_ORIGIN],
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function GET(request: Request) {
  const ctx = await verifyMcpToken(request.headers.get("authorization"))
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${AUTH_BASE}/.well-known/oauth-protected-resource"`,
      },
    })
  }

  const server = createMcpServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: true,
    allowedOrigins: [ALLOWED_ORIGIN],
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function DELETE(request: Request) {
  const ctx = await verifyMcpToken(request.headers.get("authorization"))
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${AUTH_BASE}/.well-known/oauth-protected-resource"`,
      },
    })
  }
  return new Response(null, { status: 204 })
}
