import { test, expect, type APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"
import { db, eq, user, organization } from "@workspace/db"

// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

// SSE response parser — MCP transport returns Server-Sent Events
async function parseMcpResponse(
  res: Awaited<ReturnType<APIRequestContext["post"]>>,
) {
  const text = await res.text()
  if (text.startsWith("event:") || text.startsWith("data:")) {
    const dataLines = text
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6))
    return JSON.parse(dataLines[dataLines.length - 1]!)
  }
  return JSON.parse(text)
}

// MCP JSON-RPC call helper
async function mcpCall(
  request: APIRequestContext,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
) {
  const res = await request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    data: {
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now(),
    },
  })
  return parseMcpResponse(res)
}

// Helper to assert a tool call returns access denied
async function expectAccessDenied(
  request: APIRequestContext,
  token: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const body = await mcpCall(request, token, "tools/call", {
    name: toolName,
    arguments: args,
  })
  expect(body.result).toBeDefined()
  expect(body.result.isError).toBe(true)
  expect(body.result.content[0].text).toContain("Access denied")
}

test.describe.serial("MCP server", () => {
  const testId = Date.now()
  const testUser = {
    name: "MCP Test User",
    email: `mcp-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `MCP Test Org ${testId}`,
  }

  // State shared across serial tests
  let accessToken: string
  let orgId: string

  // --- Setup ---

  test("sign up and create organization", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill(testUser.name)
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/sign-up\/org/, { timeout: 10_000 })

    await page.getByLabel("Organization name").fill(testUser.orgName)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Click into the org to get its ID from the URL
    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/orgs\/[^/]+/, { timeout: 10_000 })

    const url = page.url()
    const match = url.match(/\/orgs\/([^/]+)/)
    expect(match).not.toBeNull()
    orgId = match![1]!
  })

  // --- Authentication tests ---

  test("401 includes WWW-Authenticate header with resource_metadata", async ({
    request,
  }) => {
    const res = await request.post("/mcp", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: { jsonrpc: "2.0", method: "initialize", id: 1 },
    })
    expect(res.status()).toBe(401)
    const wwwAuth = res.headers()["www-authenticate"]
    expect(wwwAuth).toBeDefined()
    expect(wwwAuth).toContain("Bearer")
    expect(wwwAuth).toContain("resource_metadata=")
    expect(wwwAuth).toContain(".well-known/oauth-protected-resource")
  })

  test("OAuth protected resource metadata has correct shape", async ({
    request,
  }) => {
    const res = await request.get("/.well-known/oauth-protected-resource")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.resource).toContain("/mcp")
    expect(body.authorization_servers).toBeDefined()
    expect(body.authorization_servers.length).toBeGreaterThan(0)
    expect(body.authorization_servers[0]).toContain("/api/auth")
  })

  test("MCP endpoint rejects invalid token", async ({ request }) => {
    const res = await request.post("/mcp", {
      headers: {
        Authorization: "Bearer invalid-token-value",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: { jsonrpc: "2.0", method: "initialize", id: 1 },
    })
    expect(res.status()).toBe(401)
  })

  test("complete OAuth PKCE flow and get JWT token", async ({
    page,
    request,
    baseURL,
  }) => {
    const base = baseURL!

    // Sign in — each test gets a fresh page
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // 1. Register OAuth client
    const registerRes = await request.post("/api/auth/oauth2/register", {
      headers: { "Content-Type": "application/json" },
      data: {
        client_name: `mcp-test-${testId}`,
        redirect_uris: ["http://localhost:9999/callback"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    })
    expect(registerRes.status()).toBe(200)
    const clientData = await registerRes.json()
    expect(clientData.client_id).toBeDefined()
    const clientId = clientData.client_id as string

    // 2. Generate PKCE values
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // 3. Navigate to authorize endpoint
    const authUrl = new URL("/api/auth/oauth2/authorize", base)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", "http://localhost:9999/callback")
    authUrl.searchParams.set("scope", "cophrase")
    authUrl.searchParams.set("code_challenge", codeChallenge)
    authUrl.searchParams.set("code_challenge_method", "S256")
    authUrl.searchParams.set("state", "test-state")

    await page.goto(authUrl.toString())

    // 4. Consent page
    await expect(page.getByText("Authorize CoPhrase")).toBeVisible({
      timeout: 10_000,
    })

    // 5. Intercept redirect and capture code
    let capturedCode = ""
    await page.route("**/localhost:9999/callback**", async (route) => {
      const url = new URL(route.request().url())
      capturedCode = url.searchParams.get("code") ?? ""
      await route.fulfill({ status: 200, body: "OK" })
    })

    await page.getByRole("button", { name: "Allow" }).click()
    await page.waitForURL(/localhost:9999\/callback/, { timeout: 10_000 })

    expect(capturedCode.length).toBeGreaterThan(0)

    // 6. Exchange code for token with resource param
    const tokenRes = await request.post("/api/auth/oauth2/token", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: new URLSearchParams({
        grant_type: "authorization_code",
        code: capturedCode,
        redirect_uri: "http://localhost:9999/callback",
        client_id: clientId,
        code_verifier: codeVerifier,
        resource: `${base}/mcp`,
      }).toString(),
    })
    expect(tokenRes.status()).toBe(200)
    const tokenData = await tokenRes.json()
    expect(tokenData.access_token).toBeDefined()

    // 7. Verify it's a JWT
    accessToken = tokenData.access_token as string
    expect(accessToken.startsWith("eyJ")).toBe(true)
  })

  // --- MCP protocol tests ---

  test("initialize MCP session", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "playwright-test", version: "1.0" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.serverInfo).toBeDefined()
    expect(body.result.serverInfo.name).toBe("CoPhrase")
  })

  test("tools/list returns all 15 tools", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/list")
    expect(body.result).toBeDefined()
    const toolNames = body.result.tools.map((t: { name: string }) => t.name)
    expect(toolNames).toContain("list-organizations")
    expect(toolNames).toContain("list-projects")
    expect(toolNames).toContain("get-project")
    expect(toolNames).toContain("list-content-types")
    expect(toolNames).toContain("get-content-type")
    expect(toolNames).toContain("list-content")
    expect(toolNames).toContain("get-content")
    expect(toolNames).toContain("create-content")
    expect(toolNames).toContain("get-stage-instructions")
    expect(toolNames).toContain("list-artifacts")
    expect(toolNames).toContain("get-artifact")
    expect(toolNames).toContain("save-artifact")
    expect(toolNames).toContain("update-artifact-status")
    expect(toolNames).toContain("list-resources")
    expect(toolNames).toContain("get-resource")
  })

  // --- Authorization: valid org access ---

  test("list-organizations returns user orgs", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-organizations",
      arguments: {},
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const orgs = JSON.parse(body.result.content[0].text)
    expect(Array.isArray(orgs)).toBe(true)
    expect(orgs.length).toBeGreaterThan(0)
    expect(
      orgs.some((o: { name: string }) => o.name === testUser.orgName),
    ).toBe(true)
  })

  test("list-projects with valid org", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-projects",
      arguments: { organizationId: orgId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const projects = JSON.parse(body.result.content[0].text)
    expect(Array.isArray(projects)).toBe(true)
  })

  // --- Authorization: org membership checks (all org-param tools) ---

  test("list-projects denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "list-projects", {
      organizationId: "org_nonexistent",
    })
  })

  test("get-project denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "get-project", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
    })
  })

  test("list-content-types denies access for wrong org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "list-content-types", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
    })
  })

  test("list-content denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "list-content", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
    })
  })

  test("create-content denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "create-content", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
      contentTypeId: "ct_nonexistent",
      title: "Test",
    })
  })

  test("list-resources denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "list-resources", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
    })
  })

  test("get-resource denies access for wrong org", async ({ request }) => {
    await expectAccessDenied(request, accessToken, "get-resource", {
      organizationId: "org_nonexistent",
      projectId: "prj_nonexistent",
      resourceId: "res_nonexistent",
    })
  })

  // --- Authorization: record-scoped tools resolve org and check membership ---

  test("get-content denies access for nonexistent content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content",
      arguments: { contentId: "cnt_nonexistent" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("get-artifact denies access for nonexistent artifact", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-artifact",
      arguments: { artifactId: "art_nonexistent" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("list-artifacts denies access for nonexistent content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-artifacts",
      arguments: { contentId: "cnt_nonexistent" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("save-artifact denies access for nonexistent content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "save-artifact",
      arguments: {
        contentId: "cnt_nonexistent",
        type: "draft",
        title: "Test",
        data: { text: "test" },
      },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("update-artifact-status denies access for nonexistent artifact", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "update-artifact-status",
      arguments: { artifactId: "art_nonexistent", status: "approved" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("get-stage-instructions denies access for nonexistent content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-stage-instructions",
      arguments: { contentId: "cnt_nonexistent", stageId: "cts_nonexistent" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  test("get-content-type returns not found for nonexistent ID", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content-type",
      arguments: { contentTypeId: "ct_nonexistent" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("not found")
  })

  // --- Cleanup ---

  test.afterAll(async () => {
    try {
      await db.delete(user).where(eq(user.email, testUser.email))
    } catch {
      // Ignore cleanup errors
    }
    try {
      await db
        .delete(organization)
        .where(eq(organization.name, testUser.orgName))
    } catch {
      // Ignore cleanup errors
    }
  })
})
