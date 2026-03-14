import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
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
      (res) => res.url().includes("/api/content") && res.request().method() === "POST",
    )

    // Create a content piece
    await page.getByRole("button", { name: "New content" }).click()
    await page.getByLabel("Title").fill("Test Blog Post")
    await page.getByRole("button", { name: "Create" }).click()

    // Extract contentId from the API response
    const contentResponse = await contentResponsePromise
    const contentData = await contentResponse.json() as { id: string }
    contentId = contentData.id

    // Wait for content to appear in the table
    await expect(page.getByText("Test Blog Post")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("editor page loads with chat and editor panels", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    // Breadcrumb shows the content title
    await expect(page.getByText("Test Blog Post")).toBeVisible()

    // Chat panel visible with "AI Agent" header
    await expect(page.getByText("AI Agent")).toBeVisible()

    // Prompt input placeholder visible
    await expect(
      page.getByPlaceholder("Ask the AI agent..."),
    ).toBeVisible()

    // Editor has mock content heading
    await expect(
      page.getByText("The Future of Content Marketing"),
    ).toBeVisible()
  })

  test("chat sends message and receives streamed response", async ({
    page,
  }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    // Type a message and send it
    await page.getByPlaceholder("Ask the AI agent...").fill("Hello AI")
    await page.getByRole("button", { name: "Submit" }).click()

    // The user message should appear in the chat
    await expect(page.getByText("Hello AI")).toBeVisible({ timeout: 5_000 })

    // A response from the mock LLM should appear (first mock response contains this text)
    await expect(
      page.getByText(/Engaging Your Audience|analyzed your content|following edits/i),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("collapse chat panel and re-open", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    // Verify AI Agent header is visible before collapse
    await expect(page.getByText("AI Agent")).toBeVisible()

    // Collapse the chat panel
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    // AI Agent header should be hidden
    await expect(page.getByText("AI Agent")).not.toBeVisible()

    // Re-open chat via the Toggle sidebar button
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    // AI Agent header should be visible again
    await expect(page.getByText("AI Agent")).toBeVisible()
  })

  test("toolbar toggles bold formatting", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    // Wait for the editor to load
    await expect(
      page.getByText("The Future of Content Marketing"),
    ).toBeVisible()

    // Click into the ProseMirror editor
    await page.locator(".ProseMirror").click()

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

  test("version picker switches content", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    // v3 (current) is the default version label visible in the select trigger
    await expect(page.getByText("v3 (current)")).toBeVisible()

    // Key Benefits heading is present in v3 content
    await expect(page.getByText("Key Benefits")).toBeVisible()

    // Switch to v1 using the version select
    await page.getByRole("combobox", { name: "Version" }).click()
    await page.getByRole("option", { name: "v1 — Mar 10" }).click()

    // Key Benefits heading should no longer be visible in v1
    await expect(page.getByText("Key Benefits")).not.toBeVisible()
  })

  test.afterAll(async () => {
    // Delete test user (cascades to content via createdBy FK)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to remaining members, invitations)
    await db
      .delete(organization)
      .where(eq(organization.name, testUser.orgName))
  })
})
