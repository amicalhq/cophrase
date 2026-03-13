import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

async function signIn(page: any, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/", { timeout: 10_000 })
}

test.describe.serial("AI Models page", () => {
  const testId = Date.now()
  const testUser = {
    name: "AI Models Test User",
    email: `ai-models-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `AI Models Test Org ${testId}`,
  }
  let orgId = ""

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

    // Navigate to orgs page to extract orgId
    await page.goto("/orgs")
    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })

    const url = page.url()
    const orgMatch = url.match(/\/orgs\/([^/]+)/)
    expect(orgMatch).toBeTruthy()
    orgId = orgMatch![1]!
  })

  test("navigate to AI Models page shows empty states", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)
    await expect(page.getByText("No providers configured")).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText("Add a provider first to browse and enable models.")
    ).toBeVisible()
  })

  test("test connection shows error for invalid API key", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)
    await page.goto(`/orgs/${orgId}/models`)

    // Open add provider dialog
    await page.getByRole("button", { name: "Add provider" }).click()

    // Select OpenAI
    await page.getByText("OpenAI").click()

    // Fill in name and a fake API key
    await page.getByLabel("Name").fill("Test Provider")
    await page.getByLabel("API Key").fill("sk-invalid-key")

    // Click "Test connection" button
    await page.getByRole("button", { name: "Test connection" }).click()

    // Verify the error banner appears using data-testid
    const banner = page.getByTestId("connection-test-banner")
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner).toContainText(/invalid|error|denied|unauthorized/i)

    // Verify we're still on step 1 — the "Test connection" button is still visible
    await expect(
      page.getByRole("button", { name: "Test connection" })
    ).toBeVisible()

    // Close dialog
    await page.keyboard.press("Escape")
  })

  test("add provider: Next is blocked by failed connection test", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)
    await page.goto(`/orgs/${orgId}/models`)

    // Open add provider dialog
    await page.getByRole("button", { name: "Add provider" }).click()

    // Select OpenAI and fill credentials
    await page.getByText("OpenAI").click()
    await page.getByLabel("Name").fill("Test OpenAI")
    await page.getByLabel("API Key").fill("sk-test-12345")

    // Click Next — connection test will fail with fake key
    await page.getByRole("button", { name: /Next/ }).click()

    // Verify error banner appears
    const banner = page.getByTestId("connection-test-banner")
    await expect(banner).toBeVisible({ timeout: 10_000 })

    // Verify still on step 1 (dialog title is "Add provider", not "Enable models")
    await expect(
      page.getByRole("button", { name: "Test connection" })
    ).toBeVisible()

    // Close dialog
    await page.keyboard.press("Escape")
  })

  test("setup: create provider via API", async ({ page }) => {
    // Sign in via the browser to get auth cookies
    await signIn(page, testUser.email, testUser.password)

    // Create provider directly via API (bypasses connection test)
    const res = await page.request.post("/api/providers", {
      data: {
        orgId,
        name: "Test OpenAI",
        providerType: "openai",
        apiKey: "sk-test-12345",
        models: [
          { modelId: "gpt-4o", modelType: "language" },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    // Verify provider card appears on page
    await page.goto(`/orgs/${orgId}/models`)
    await expect(page.getByText("Test OpenAI")).toBeVisible({ timeout: 10_000 })
  })

  test("verify model in table", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // The API-created provider has 1 model (gpt-4o)
    await expect(
      page.getByText(/\d+ model\(s\)/)
    ).toBeVisible({ timeout: 10_000 })
  })

  test("edit provider", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // Click the provider card
    await page.getByText("Test OpenAI").click()

    // Verify "Test connection" button exists in edit dialog
    await expect(
      page.getByRole("button", { name: "Test connection" })
    ).toBeVisible()

    // Edit the name
    const nameInput = page.getByLabel("Name")
    await nameInput.clear()
    await nameInput.fill("Renamed OpenAI")

    // Save changes
    await page.getByRole("button", { name: "Save changes" }).click()

    // Verify the card now shows the new name
    await expect(page.getByText("Renamed OpenAI")).toBeVisible({
      timeout: 10_000,
    })
  })

  test("delete provider", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // Click the provider card
    await page.getByText("Renamed OpenAI").click()

    // Click delete provider button
    await page.getByRole("button", { name: "Delete provider" }).click()

    // Click confirm delete
    await page.getByRole("button", { name: "Confirm delete" }).click()

    // Verify the provider card disappears and empty state returns
    await expect(page.getByText("Renamed OpenAI")).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("No providers configured")).toBeVisible()
  })

  test.afterAll(async () => {
    // Delete test user (cascades to providers/models via org membership)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to providers, models, members)
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
