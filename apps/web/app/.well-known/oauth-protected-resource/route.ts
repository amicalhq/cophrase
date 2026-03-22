const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

export function GET() {
  return Response.json({
    resource: `${ORIGIN}/mcp`,
    authorization_servers: [`${ORIGIN}/api/auth`],
  })
}
