import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"
import { trpcMutate } from "./helpers/trpc"

test.describe.serial("Content type agents", () => {
  const testId = Date.now()
  const testUser = {
    name: "Agents Test User",
    email: `agents-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Agents Test Org ${testId}`,
  }
  let orgId = ""
  let projectId = ""

  test("setup: sign up and create org", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill(testUser.name)
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/sign-up\/org/, { timeout: 10_000 })
    await page.getByLabel("Organization name").fill(testUser.orgName)
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })
  })

  test("setup: create a project", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto("/orgs")
    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })

    const url = page.url()
    const orgMatch = url.match(/\/orgs\/([^/]+)/)
    expect(orgMatch).toBeTruthy()
    orgId = orgMatch![1]!

    await page.getByRole("button", { name: "New project" }).click()
    await page.getByLabel("Name").fill(`Test Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()

    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })

    const projectUrl = page.url()
    const projMatch = projectUrl.match(/\/projects\/([^/]+)/)
    expect(projMatch).toBeTruthy()
    projectId = projMatch![1]!
  })

  test("agents tab shows template gallery", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)
    await expect(
      page.getByRole("heading", { name: "Agents" })
    ).toBeVisible()
    await expect(page.getByText("Blog Post")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Install" }).first()
    ).toBeVisible()
  })

  test("can install a content type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)

    // Find the Blog Post card via its heading, then locate the Install button within the same card
    const blogCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Blog Post" })
      .first()
    await blogCard.getByRole("button", { name: "Install" }).click()

    // Wait for the page to refresh and show the installed state
    await expect(
      page.getByRole("button", { name: "Installed" }).first()
    ).toBeVisible({ timeout: 10_000 })

    // Verify Blog Post appears in the installed list (as a link)
    await expect(
      page.getByRole("link", { name: /Blog Post/ })
    ).toBeVisible()
  })

  test("installed type shows stages", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)

    // The installed list shows the stage pipeline as "Research → Draft → Refine"
    const installedLink = page.getByRole("link", { name: /Blog Post/ })
    await expect(installedLink).toBeVisible()
    await expect(installedLink).toContainText("Research")
    await expect(installedLink).toContainText("Draft")
    await expect(installedLink).toContainText("Refine")
  })

  test("content type detail page", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)

    // Click on the installed Blog Post entry to go to the detail page
    await page.getByRole("link", { name: /Blog Post/ }).click()

    // URL should contain a content type ID
    await expect(page).toHaveURL(/\/agents\//, { timeout: 10_000 })

    // Verify the heading shows the content type name
    await expect(
      page.getByRole("heading", { name: "Blog Post" })
    ).toBeVisible()

    // Verify stage names are visible (use exact to avoid matching sub-agent descriptions)
    await expect(page.getByText("Research", { exact: true })).toBeVisible()
    await expect(page.getByText("Draft", { exact: true })).toBeVisible()
    await expect(page.getByText("Refine", { exact: true })).toBeVisible()

    // Verify at least one sub-agent name is visible
    await expect(
      page.getByText("Blog Research Agent")
    ).toBeVisible()
  })

  test("content page shows installed types", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByRole("button", { name: "New content" }).click()
    await expect(
      page.getByRole("dialog").getByText("Blog Post")
    ).toBeVisible()

    // Close dialog by pressing Escape
    await page.keyboard.press("Escape")
  })

  test("can create content with installed type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByRole("button", { name: "New content" }).click()
    await page.getByLabel("Title").fill("Test Blog")
    // Blog Post should be the default selection
    await page.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Test Blog")).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByRole("table").getByText("Blog Post", { exact: true })
    ).toBeVisible()
  })

  test("can delete content type when no content references it", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Install X Post via API
    await trpcMutate(page.request, 'contentTypes.install', {
      templateId: "seed_cty_x", projectId, orgId,
    })

    // Navigate to agents page and verify X Post is installed
    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)
    await expect(page.getByRole("link", { name: /X Post/ })).toBeVisible({
      timeout: 10_000,
    })

    // Click on X Post to go to detail
    await page.getByRole("link", { name: /X Post/ }).click()
    await expect(page).toHaveURL(/\/agents\//, { timeout: 10_000 })

    // Click delete button
    await page.getByRole("button", { name: "Delete content type" }).click()

    // Should redirect back to agents list
    await expect(page).toHaveURL(/\/agents$/, { timeout: 10_000 })

    // X Post should no longer appear in the installed list
    await expect(
      page.getByRole("link", { name: /X Post/ })
    ).not.toBeVisible()
  })

  test.afterAll(async () => {
    await db.delete(user).where(eq(user.email, testUser.email))
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
