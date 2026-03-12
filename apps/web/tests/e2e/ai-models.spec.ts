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

  test("add provider", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // Click Add provider button
    await page.getByRole("button", { name: "Add provider" }).click()

    // Select OpenAI provider type card
    await page.getByText("OpenAI").click()

    // Fill in provider name
    await page.getByLabel("Name").fill("Test OpenAI")

    // Fill in API key
    await page.getByLabel("API Key").fill("sk-test-12345")

    // Click Next: Select models
    await page.getByRole("button", { name: "Next: Select models →" }).click()

    // Wait for models to load (external API call to models.dev)
    await expect(page.getByRole("checkbox").first()).toBeVisible({
      timeout: 15_000,
    })

    // Verify at least one model checkbox is checked (auto-selected)
    const checkedCheckboxes = page.getByRole("checkbox", { checked: true })
    await expect(checkedCheckboxes.first()).toBeVisible()

    // Submit the form
    await page.getByRole("button", { name: "Add provider & models" }).click()

    // Verify the provider card appears
    await expect(page.getByText("Test OpenAI")).toBeVisible({ timeout: 10_000 })
  })

  test("verify model in table", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // After adding provider, at least one model should appear in the models section
    // The models table shows "X model(s)" count
    await expect(
      page.getByText(/\d+ model\(s\)/)
    ).toBeVisible({ timeout: 10_000 })
  })

  test("edit provider", async ({ page }) => {
    await signIn(page, testUser.email, testUser.password)

    await page.goto(`/orgs/${orgId}/models`)

    // Click the provider card
    await page.getByText("Test OpenAI").click()

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
