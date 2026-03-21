import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/", { timeout: 10_000 })
}

test.describe.serial("AI Editor page", () => {
  const testId = Date.now()
  const testUser = {
    name: "Editor Test User",
    email: `editor-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Editor Test Org ${testId}`,
  }
  let orgId = ""
  let projectId = ""
  let contentId = ""

  test("setup: sign up and create org", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill(testUser.name)
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/sign-up\/org/, { timeout: 10_000 })
    await page.getByLabel("Organization name").fill(testUser.orgName)
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })
  })

  test("setup: create project and content", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    // Navigate to orgs page and find org
    await page.goto("/orgs")
    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })

    // Extract orgId from URL
    const url = page.url()
    const orgMatch = url.match(/\/orgs\/([^/]+)/)
    expect(orgMatch).toBeTruthy()
    orgId = orgMatch![1]!

    // Create a project
    await page.getByRole("button", { name: "New project" }).click()
    await page.getByLabel("Name").fill(`Test Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()

    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })

    // Extract projectId from URL
    const projectUrl = page.url()
    const projMatch = projectUrl.match(/\/projects\/([^/]+)/)
    expect(projMatch).toBeTruthy()
    projectId = projMatch![1]!

    // Intercept the API response to capture the new contentId
    const contentResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/trpc/content.create") && res.request().method() === "POST"
    )

    // Create a content piece
    await page.getByRole("button", { name: "New content" }).click()
    await page.getByLabel("Title").fill("Test Blog Post")
    await page.getByRole("button", { name: "Create" }).click()

    // Extract contentId from the tRPC response
    const contentResponse = await contentResponsePromise
    const trpcData = (await contentResponse.json()) as {
      result: { data: { json: { id: string } } }
    }
    contentId = trpcData.result.data.json.id

    // Wait for content to appear in the table
    await expect(page.getByText("Test Blog Post")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("editor page loads with chat and editor panels", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Breadcrumb shows the content title
    await expect(page.getByText("Test Blog Post")).toBeVisible()

    // Chat panel visible with "AI Agent" header
    await expect(page.getByRole("tab", { name: "AI Agent" })).toBeVisible()

    // Prompt input placeholder visible
    await expect(page.getByPlaceholder("Ask the AI agent...")).toBeVisible()

    // Tiptap editor renders
    await expect(page.locator(".ProseMirror")).toBeVisible()
  })

  test("shows model picker fallback when no models configured", async ({
    page,
  }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Prompt input should be visible
    await expect(page.getByPlaceholder("Ask the AI agent...")).toBeVisible()

    // With no models configured, the fallback text should appear in the prompt footer
    await expect(
      page.getByText("No models configured")
    ).toBeVisible({ timeout: 5_000 })
  })

  test("shows initial suggestion buttons for empty conversation", async ({
    page,
  }) => {
    await signIn(page, testUser.email, testUser.password)

    // Intercept messages endpoint to return empty conversation
    await page.route("**/api/trpc/content.messages*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { messages: [] } } } }),
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Expect the primary suggestion button to be visible
    await expect(
      page.getByRole("button", { name: "Start researching" })
    ).toBeVisible({ timeout: 5_000 })

    // Expect the secondary suggestion button to be visible
    await expect(
      page.getByRole("button", { name: "Add more context" })
    ).toBeVisible()
  })

  test("clicking a suggestion sends it as a message", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    // Return empty conversation for initial suggestions
    await page.route("**/api/trpc/content.messages*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { messages: [] } } } }),
      })
    })

    // Intercept the chat endpoint
    await page.route("**/api/content/*/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Wait for suggestion to appear, then click it
    const suggestion = page.getByRole("button", { name: "Start researching" })
    await expect(suggestion).toBeVisible({ timeout: 5_000 })
    await suggestion.click()

    // The suggestion prompt should appear as a user message in the chat
    await expect(
      page.getByText("Research this topic and find relevant sources")
    ).toBeVisible({ timeout: 5_000 })
  })

  test("suggestions hide during streaming", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    // Return empty conversation for initial suggestions
    await page.route("**/api/trpc/content.messages*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { messages: [] } } } }),
      })
    })

    // Intercept the chat endpoint with a delayed response to keep streaming state
    await page.route("**/api/content/*/chat", async (route) => {
      // Hold the response open to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Wait for suggestion to appear
    const suggestion = page.getByRole("button", { name: "Start researching" })
    await expect(suggestion).toBeVisible({ timeout: 5_000 })

    // Click it to trigger streaming
    await suggestion.click()

    // Suggestions should disappear during streaming
    await expect(suggestion).not.toBeVisible({ timeout: 3_000 })
  })

  test("suggestions appear from suggest-next-actions tool call after turn", async ({
    page,
  }) => {
    await signIn(page, testUser.email, testUser.password)

    // Return empty conversation
    await page.route("**/api/trpc/content.messages*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { messages: [] } } } }),
      })
    })

    // Mock chat response with a suggest-next-actions tool call in the SSE stream
    const sseBody = [
      `data: ${JSON.stringify({ type: "text-delta", delta: "Research complete." })}\n\n`,
      `data: ${JSON.stringify({ type: "tool-input-start", toolCallId: "tc1", toolName: "suggest-next-actions" })}\n\n`,
      `data: ${JSON.stringify({
        type: "tool-input-available",
        toolCallId: "tc1",
        input: {
          suggestions: [
            {
              label: "Start drafting",
              prompt: "Write a draft based on the research",
              primary: true,
            },
            { label: "More research", prompt: "Do more research" },
          ],
        },
      })}\n\n`,
      `data: ${JSON.stringify({ type: "tool-result", toolCallId: "tc1", output: { ok: true } })}\n\n`,
    ].join("")

    await page.route("**/api/content/*/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Click the initial suggestion to trigger a chat turn
    const initialSuggestion = page.getByRole("button", {
      name: "Start researching",
    })
    await expect(initialSuggestion).toBeVisible({ timeout: 5_000 })
    await initialSuggestion.click()

    // After the turn completes, the harness-generated suggestions should appear
    await expect(
      page.getByRole("button", { name: "Start drafting" })
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByRole("button", { name: "More research" })
    ).toBeVisible()

    // The suggest-next-actions tool call should NOT be visible as a ToolCallBlock
    await expect(page.getByText("suggest next actions")).not.toBeVisible()
  })

  test("chat sends message and receives streamed response", async ({
    page,
  }) => {
    await signIn(page, testUser.email, testUser.password)

    // Intercept the chat endpoint to provide a mock streaming response
    await page.route("**/api/content/*/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Type a message and send it
    await page.getByPlaceholder("Ask the AI agent...").fill("Hello AI")
    await page.getByRole("button", { name: "Submit" }).click()

    // The user message should appear in the chat
    await expect(page.getByText("Hello AI")).toBeVisible({ timeout: 5_000 })
  })

  test("collapse chat panel and re-open", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Verify AI Agent header is visible before collapse
    await expect(page.getByRole("tab", { name: "AI Agent" })).toBeVisible()

    // Collapse the chat panel
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    // AI Agent header should be hidden
    await expect(page.getByRole("tab", { name: "AI Agent" })).not.toBeVisible()

    // Re-open chat via the Toggle sidebar button
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    // AI Agent header should be visible again
    await expect(page.getByRole("tab", { name: "AI Agent" })).toBeVisible()
  })

  test("toolbar toggles bold formatting", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Wait for the Tiptap editor to load
    await expect(page.locator(".ProseMirror")).toBeVisible()

    // Click into the ProseMirror editor and type some text
    await page.locator(".ProseMirror").click()
    await page.keyboard.type("Some sample text")

    // Select all text (cross-platform)
    await page.keyboard.press("ControlOrMeta+a")

    // The Bold button should not be active initially (not all text is bold)
    const boldButton = page.getByRole("button", { name: "Bold" }).first()
    await expect(boldButton).toBeVisible()

    // Click the Bold button to apply bold formatting
    await boldButton.click()

    // Bold button should now be toggled on (data-state="on")
    await expect(boldButton).toHaveAttribute("data-state", "on")
  })

  test("harness chat sends message and receives response", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    // Intercept the chat endpoint to provide a mock response
    await page.route("**/api/content/*/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      })
    })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`
    )

    // Verify chat input is visible
    const chatInput = page.getByPlaceholder(/ask the ai agent/i)
    await expect(chatInput).toBeVisible()

    // Verify Tiptap editor renders
    await expect(page.locator(".ProseMirror")).toBeVisible()

    // Type and send a message
    await chatInput.fill("Hello, can you help me write a blog post?")
    await chatInput.press("Enter")

    // Verify the user message appears in chat
    await expect(
      page.getByText("Hello, can you help me write a blog post?")
    ).toBeVisible()
  })

  test.afterAll(async () => {
    // Delete test user (cascades to content via createdBy FK)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to remaining members, invitations)
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
