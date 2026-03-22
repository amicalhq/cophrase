import { test, expect, type APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"
import {
  db,
  eq,
  and,
  user,
  organization,
  project,
  contentType,
  contentTypeStage,
  content,
  artifact,
} from "@workspace/db"

// Inline ID generators (same format as @workspace/id but avoids adding the dep)
function testId8(prefix: string) {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`
}
function testId16(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`
}

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

  // Org A's own test data (for positive-path tests)
  const ownProjectId = testId8("prj")
  const ownContentTypeId = testId8("cty")
  const ownStageId = testId8("cts")
  let ownContentId: string
  let ownArtifactId: string

  // Org B's test data (for cross-org isolation tests)
  const otherOrgId = testId8("org")
  const otherProjectId = testId8("prj")
  const otherContentTypeId = testId8("cty")
  const otherStageId = testId8("cts")
  const otherContentId = testId8("ct")
  const otherArtifactId = testId16("atf")
  const otherOrgName = `Other Org ${testId}`

  // =====================================================================
  // Setup
  // =====================================================================

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

    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/orgs\/[^/]+/, { timeout: 10_000 })

    const url = page.url()
    const match = url.match(/\/orgs\/([^/]+)/)
    expect(match).not.toBeNull()
    orgId = match![1]!
  })

  // =====================================================================
  // Authentication
  // =====================================================================

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

    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

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

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const authUrl = new URL("/api/auth/oauth2/authorize", base)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", "http://localhost:9999/callback")
    authUrl.searchParams.set("scope", "cophrase")
    authUrl.searchParams.set("code_challenge", codeChallenge)
    authUrl.searchParams.set("code_challenge_method", "S256")
    authUrl.searchParams.set("state", "test-state")

    await page.goto(authUrl.toString())
    await expect(page.getByText("Authorize CoPhrase")).toBeVisible({
      timeout: 10_000,
    })

    let capturedCode = ""
    await page.route("**/localhost:9999/callback**", async (route) => {
      const url = new URL(route.request().url())
      capturedCode = url.searchParams.get("code") ?? ""
      await route.fulfill({ status: 200, body: "OK" })
    })

    await page.getByRole("button", { name: "Allow" }).click()
    await page.waitForURL(/localhost:9999\/callback/, { timeout: 10_000 })
    expect(capturedCode.length).toBeGreaterThan(0)

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

    accessToken = tokenData.access_token as string
    expect(accessToken.startsWith("eyJ")).toBe(true)
  })

  // =====================================================================
  // MCP protocol
  // =====================================================================

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

  // =====================================================================
  // Positive path: create data in Org A and verify tools work for owner
  // =====================================================================

  test("setup: create project and content type in own org", async () => {
    await db.insert(project).values({
      id: ownProjectId,
      name: "Test Project",
      organizationId: orgId,
    })

    await db.insert(contentType).values({
      id: ownContentTypeId,
      scope: "project",
      organizationId: orgId,
      projectId: ownProjectId,
      name: "Test Blog Post",
      format: "rich_text",
    })

    await db.insert(contentTypeStage).values({
      id: ownStageId,
      contentTypeId: ownContentTypeId,
      name: "Research",
      position: 1,
    })
  })

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

  test("list-projects with valid org returns own project", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-projects",
      arguments: { organizationId: orgId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const projects = JSON.parse(body.result.content[0].text)
    expect(projects.some((p: { id: string }) => p.id === ownProjectId)).toBe(
      true,
    )
  })

  test("list-content-types with valid org returns own content type", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-content-types",
      arguments: { organizationId: orgId, projectId: ownProjectId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const types = JSON.parse(body.result.content[0].text)
    expect(
      types.some((t: { id: string }) => t.id === ownContentTypeId),
    ).toBe(true)
  })

  test("get-content-type with own content type succeeds", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content-type",
      arguments: { contentTypeId: ownContentTypeId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const ct = JSON.parse(body.result.content[0].text)
    expect(ct.id).toBe(ownContentTypeId)
  })

  test("create-content in own org succeeds", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "create-content",
      arguments: {
        organizationId: orgId,
        projectId: ownProjectId,
        contentTypeId: ownContentTypeId,
        title: "My Test Content",
      },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const created = JSON.parse(body.result.content[0].text)
    expect(created.id).toBeDefined()
    ownContentId = created.id
  })

  test("get-content with own content succeeds", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content",
      arguments: { contentId: ownContentId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const item = JSON.parse(body.result.content[0].text)
    expect(item.id).toBe(ownContentId)
    expect(item.title).toBe("My Test Content")
  })

  test("save-artifact in own content succeeds", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "save-artifact",
      arguments: {
        contentId: ownContentId,
        type: "draft",
        title: "My Draft",
        data: { text: "hello world" },
      },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const saved = JSON.parse(body.result.content[0].text)
    expect(saved.id).toBeDefined()
    ownArtifactId = saved.id
  })

  test("get-artifact with own artifact succeeds", async ({ request }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-artifact",
      arguments: { artifactId: ownArtifactId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const art = JSON.parse(body.result.content[0].text)
    expect(art.id).toBe(ownArtifactId)
    expect(art.title).toBe("My Draft")
  })

  test("list-artifacts with own content returns artifact", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-artifacts",
      arguments: { contentId: ownContentId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const arts = JSON.parse(body.result.content[0].text)
    expect(arts.some((a: { id: string }) => a.id === ownArtifactId)).toBe(true)
  })

  test("get-stage-instructions with own content succeeds", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-stage-instructions",
      arguments: { contentId: ownContentId, stageId: ownStageId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const stage = JSON.parse(body.result.content[0].text)
    expect(stage.stage.id).toBe(ownStageId)
    expect(stage.stage.name).toBe("Research")
  })

  test("update-artifact-status with own artifact succeeds", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "update-artifact-status",
      arguments: { artifactId: ownArtifactId, status: "approved" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBeFalsy()
    const updated = JSON.parse(body.result.content[0].text)
    expect(updated.status).toBe("approved")
  })

  // =====================================================================
  // Not-found behavior (record lookup, NOT authz)
  // =====================================================================

  test("get-content returns not found for nonexistent ID", async ({
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

  test("get-artifact returns not found for nonexistent ID", async ({
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

  // =====================================================================
  // Cross-org isolation: real records in a different org
  // Proves that isOrgMember actually blocks access to existing records
  // =====================================================================

  test("setup: create second org with real records", async () => {
    await db.insert(organization).values({
      id: otherOrgId,
      name: otherOrgName,
      slug: `other-org-${testId}`,
      createdAt: new Date(),
    })

    await db.insert(project).values({
      id: otherProjectId,
      name: "Other Project",
      organizationId: otherOrgId,
    })

    await db.insert(contentType).values({
      id: otherContentTypeId,
      scope: "project",
      organizationId: otherOrgId,
      projectId: otherProjectId,
      name: "Other Blog Post",
      format: "rich_text",
    })

    await db.insert(contentTypeStage).values({
      id: otherStageId,
      contentTypeId: otherContentTypeId,
      name: "Research",
      position: 1,
    })

    await db.insert(content).values({
      id: otherContentId,
      organizationId: otherOrgId,
      projectId: otherProjectId,
      contentTypeId: otherContentTypeId,
      currentStageId: otherStageId,
      title: "Other Content",
    })

    await db.insert(artifact).values({
      id: otherArtifactId,
      organizationId: otherOrgId,
      projectId: otherProjectId,
      contentId: otherContentId,
      type: "draft",
      title: "Other Draft",
      data: { text: "secret content from other org" },
    })
  })

  // --- Cross-org: org-param tools with real Org B ID ---

  test("cross-org: list-projects denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "list-projects", {
      organizationId: otherOrgId,
    })
  })

  test("cross-org: get-project denies access to other org's project", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "get-project", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
    })
  })

  test("cross-org: list-content-types denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "list-content-types", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
    })
  })

  test("cross-org: list-content denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "list-content", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
    })
  })

  test("cross-org: create-content denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "create-content", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
      contentTypeId: otherContentTypeId,
      title: "Injected Content",
    })
  })

  test("cross-org: list-resources denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "list-resources", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
    })
  })

  test("cross-org: get-resource denies access to other org", async ({
    request,
  }) => {
    await expectAccessDenied(request, accessToken, "get-resource", {
      organizationId: otherOrgId,
      projectId: otherProjectId,
      resourceId: "res_nonexistent",
    })
  })

  // --- Cross-org: record-scoped tools with real Org B records ---

  test("cross-org: get-content denies access to other org's content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content",
      arguments: { contentId: otherContentId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")
  })

  test("cross-org: get-artifact denies access to other org's artifact", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-artifact",
      arguments: { artifactId: otherArtifactId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")
  })

  test("cross-org: list-artifacts denies access to other org's content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "list-artifacts",
      arguments: { contentId: otherContentId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")
  })

  test("cross-org: save-artifact denies write to other org's content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "save-artifact",
      arguments: {
        contentId: otherContentId,
        type: "draft",
        title: "Injected",
        data: { text: "should not be saved" },
      },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")

    // Verify no artifact was actually created
    const rows = await db
      .select({ id: artifact.id, title: artifact.title })
      .from(artifact)
      .where(
        and(
          eq(artifact.contentId, otherContentId),
          eq(artifact.title, "Injected"),
        ),
      )
    expect(rows).toHaveLength(0)
  })

  test("cross-org: update-artifact-status denies write to other org's artifact", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "update-artifact-status",
      arguments: { artifactId: otherArtifactId, status: "approved" },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")

    // Verify artifact status was NOT changed
    const [row] = await db
      .select({ status: artifact.status })
      .from(artifact)
      .where(eq(artifact.id, otherArtifactId))
    expect(row.status).toBe("ready")
  })

  test("cross-org: get-stage-instructions denies access to other org's content", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-stage-instructions",
      arguments: { contentId: otherContentId, stageId: otherStageId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Access denied")
  })

  test("cross-org: get-content-type denies access to other org's content type", async ({
    request,
  }) => {
    const body = await mcpCall(request, accessToken, "tools/call", {
      name: "get-content-type",
      arguments: { contentTypeId: otherContentTypeId },
    })
    expect(body.result).toBeDefined()
    expect(body.result.isError).toBe(true)
    // Returns "not found" instead of "Access denied" to avoid info disclosure
    expect(body.result.content[0].text).toContain("not found")
  })

  // =====================================================================
  // Cleanup
  // =====================================================================

  test.afterAll(async () => {
    try {
      await db.delete(organization).where(eq(organization.id, otherOrgId))
    } catch {
      // Ignore cleanup errors
    }
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
