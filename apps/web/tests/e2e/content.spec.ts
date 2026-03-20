import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

test.describe.serial("Content pieces", () => {
  const testId = Date.now()
  const testUser = {
    name: "Content Test User",
    email: `content-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Content Test Org ${testId}`,
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
    await expect(page).toHaveURL("/", { timeout: 10_000 })
  })

  test("setup: create a project", async ({ page }) => {
    // Sign in
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

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
  })

  test("content page shows empty state", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)
    await expect(page.getByText("Content")).toBeVisible()
    await expect(
      page.getByText("No content yet")
    ).toBeVisible()
  })

  test("can create content via dialog", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Create a blog post
    await page.getByRole("button", { name: "New content" }).click()
    await expect(page.getByText("New content").first()).toBeVisible()

    await page.getByLabel("Title").fill("My First Blog Post")
    // "Blog Post" is selected by default (first content type)
    await page.getByRole("button", { name: "Create" }).click()

    // Should see the new content in the table
    await expect(page.getByText("My First Blog Post")).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.getByText("Blog Post")).toBeVisible()
    // New content is created without a stage (currentStageId is null)
  })

  test("can create X post", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByRole("button", { name: "New content" }).click()
    await page.getByLabel("Title").fill("Launch Announcement")
    await page.getByText("X Post").click()
    await page.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Launch Announcement")).toBeVisible({
      timeout: 5_000,
    })
    await expect(page.getByText("X Post")).toBeVisible()
  })

  test("can filter by type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Both items should be visible initially
    await expect(page.getByText("My First Blog Post")).toBeVisible()
    await expect(page.getByText("Launch Announcement")).toBeVisible()

    // Filter by Blog Post type using ToggleGroup button
    const toggleGroup = page.getByRole("group")
    await toggleGroup.getByRole("button", { name: "Blog Post" }).click()

    await expect(page.getByText("My First Blog Post")).toBeVisible()
    await expect(page.getByText("Launch Announcement")).not.toBeVisible()

    // Deselect Blog Post to show all again
    await toggleGroup.getByRole("button", { name: "Blog Post" }).click()
    await expect(page.getByText("Launch Announcement")).toBeVisible()
  })

  test("can search by title", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByPlaceholder("Search by title...").fill("Launch")

    await expect(page.getByText("Launch Announcement")).toBeVisible()
    await expect(page.getByText("My First Blog Post")).not.toBeVisible()
  })

  test("stage filter shows only All stages when content has no stages", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Both items should be visible with "All stages" selected
    await expect(page.getByText("My First Blog Post")).toBeVisible()
    await expect(page.getByText("Launch Announcement")).toBeVisible()

    // The stage select should show "All stages" by default
    await expect(page.getByRole("combobox")).toContainText("All stages")
  })

  test("creates content with Untitled fallback when title is empty", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Create content without filling in a title
    await page.getByRole("button", { name: "New content" }).click()
    await page.getByRole("button", { name: "Create" }).click()

    // Should see "Untitled" in the table
    await expect(page.getByText("Untitled")).toBeVisible({ timeout: 5_000 })
  })

  test("content tab is visible in navigation", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/", { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Verify Content tab exists in navigation
    const contentTab = page.getByRole("link", { name: "Content" })
    await expect(contentTab).toBeVisible()

    // Click it and verify navigation
    await contentTab.click()
    await expect(page).toHaveURL(/\/content/, { timeout: 5_000 })
  })

  test.afterAll(async () => {
    // Delete test user (cascades to content via createdBy FK)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to remaining members, invitations)
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
