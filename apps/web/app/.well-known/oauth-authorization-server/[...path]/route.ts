const AUTH_BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const ISSUER = `${AUTH_BASE}/api/auth`

export function GET() {
  return Response.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth2/authorize`,
    token_endpoint: `${ISSUER}/oauth2/token`,
    registration_endpoint: `${ISSUER}/oauth2/register`,
    jwks_uri: `${ISSUER}/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["cophrase"],
  })
}
