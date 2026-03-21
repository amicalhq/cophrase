import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"
import { trpcMutate, trpcQuery } from "./helpers/trpc"

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
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })
  })

  test("setup: create a project", async ({ page }) => {
    // Sign in
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

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

  test("setup: install content types", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await trpcMutate(page.request, 'contentTypes.install', {
      templateId: "seed_cty_blog", projectId, orgId,
    })

    await trpcMutate(page.request, 'contentTypes.install', {
      templateId: "seed_cty_x", projectId, orgId,
    })
  })

  test("content page shows empty state", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)
    await expect(page.getByRole("heading", { name: "Content" })).toBeVisible()
    await expect(page.getByText("No content yet")).toBeVisible()
  })

  test("can create content via dialog", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Create a blog post
    await page.getByRole("button", { name: "New content" }).click()
    await expect(page.getByText("New content").first()).toBeVisible()

    await page.getByLabel("Title").fill("My First Blog Post")
    // "Blog Post" is selected by default (first content type)
    await page.getByRole("button", { name: "Create" }).click()

    // Dismiss post-creation dialog if shown
    const pickUpLater = page.getByRole("button", { name: "Pick up later" })
    await expect(pickUpLater).toBeVisible({ timeout: 5_000 })
    await pickUpLater.click()

    // Should see the new content in the table
    await expect(page.getByText("My First Blog Post")).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page.getByRole("table").getByText("Blog Post", { exact: true })
    ).toBeVisible()
    // New content is created without a stage (currentStageId is null)
  })

  test("can create X post", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByRole("button", { name: "New content" }).click()
    await page.getByLabel("Title").fill("Launch Announcement")
    await page.getByRole("dialog").getByText("X Post").click()
    await page.getByRole("button", { name: "Create" }).click()

    // Dismiss post-creation dialog if shown
    const pickUpLater = page.getByRole("button", { name: "Pick up later" })
    await expect(pickUpLater).toBeVisible({ timeout: 5_000 })
    await pickUpLater.click()

    await expect(page.getByText("Launch Announcement")).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page.getByRole("table").getByText("X Post", { exact: true })
    ).toBeVisible()
  })

  test("can filter by type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

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
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await page.getByPlaceholder("Search by title...").fill("Launch")

    await expect(page.getByText("Launch Announcement")).toBeVisible()
    await expect(page.getByText("My First Blog Post")).not.toBeVisible()
  })

  test("stage filter shows only All stages when content has no stages", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Both items should be visible with "All stages" selected
    await expect(page.getByText("My First Blog Post")).toBeVisible()
    await expect(page.getByText("Launch Announcement")).toBeVisible()

    // The stage select should show "All stages" by default
    await expect(page.getByRole("combobox")).toContainText("All stages")
  })

  test("creates content with Untitled fallback when title is empty", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Create content without filling in a title
    await page.getByRole("button", { name: "New content" }).click()
    await page.getByRole("button", { name: "Create" }).click()

    // Dismiss post-creation dialog if shown
    const pickUpLater = page.getByRole("button", { name: "Pick up later" })
    await expect(pickUpLater).toBeVisible({ timeout: 5_000 })
    await pickUpLater.click()

    // Should see "Untitled" in the table
    await expect(page.getByText("Untitled")).toBeVisible({ timeout: 5_000 })
  })

  test("content tab is visible in navigation", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    // Verify Content tab exists in navigation
    const contentTab = page.getByRole("link", { name: "Content", exact: true })
    await expect(contentTab).toBeVisible()

    // Click it and verify navigation
    await contentTab.click()
    await expect(page).toHaveURL(/\/content/, { timeout: 5_000 })
  })

  test("can delete a single content item", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get a content type to create content via API
    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const blogType = types.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogType).toBeTruthy()

    // Create content via API
    const content = await trpcMutate(page.request, 'content.create', {
      projectId, orgId,
      title: "Delete Me",
      contentTypeId: blogType.id,
    })
    expect(content.id).toBeTruthy()

    // Navigate to content list
    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)
    await expect(page.getByText("Delete Me")).toBeVisible({ timeout: 5_000 })

    // Open the actions dropdown for the "Delete Me" row
    const row = page.getByRole("row").filter({ hasText: "Delete Me" })
    await row.getByRole("button", { name: "Actions" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Read the confirmation code from the dialog
    const codeSpan = page.locator(".font-mono.font-semibold.text-foreground")
    await expect(codeSpan).toBeVisible({ timeout: 5_000 })
    const code = await codeSpan.textContent()
    expect(code).toBeTruthy()

    // Enter the confirmation code
    await page.getByPlaceholder(code!).fill(code!)

    // Click the delete button
    await page.getByRole("button", { name: "Delete", exact: true }).click()

    // Verify the content is removed
    await expect(page.getByText("Delete Me")).not.toBeVisible({ timeout: 5_000 })
  })

  test("can bulk delete content items", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get a content type
    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const blogType = types.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogType).toBeTruthy()

    // Create 2 content items via API
    const item1 = await trpcMutate(page.request, 'content.create', {
      projectId, orgId,
      title: "Bulk Delete A",
      contentTypeId: blogType.id,
    })
    expect(item1.id).toBeTruthy()

    const item2 = await trpcMutate(page.request, 'content.create', {
      projectId, orgId,
      title: "Bulk Delete B",
      contentTypeId: blogType.id,
    })
    expect(item2.id).toBeTruthy()

    // Navigate to content list
    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)
    await expect(page.getByText("Bulk Delete A")).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("Bulk Delete B")).toBeVisible()

    // Select both checkboxes via the row checkboxes
    const rowA = page.getByRole("row").filter({ hasText: "Bulk Delete A" })
    await rowA.getByRole("checkbox").click()

    const rowB = page.getByRole("row").filter({ hasText: "Bulk Delete B" })
    await rowB.getByRole("checkbox").click()

    // Click the bulk delete button
    await expect(page.getByText("2 selected")).toBeVisible()
    await page.getByRole("button", { name: "Delete" }).click()

    // Read the confirmation code from the bulk delete dialog
    const codeSpan = page.locator(".font-mono.font-semibold.text-foreground")
    await expect(codeSpan).toBeVisible({ timeout: 5_000 })
    const code = await codeSpan.textContent()
    expect(code).toBeTruthy()

    // Enter the confirmation code
    await page.getByPlaceholder(code!).fill(code!)

    // Click the confirm button (shows "Delete 2")
    await page.getByRole("button", { name: /Delete 2/ }).click()

    // Verify both items are removed
    await expect(page.getByText("Bulk Delete A")).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("Bulk Delete B")).not.toBeVisible()
  })

  test.afterAll(async () => {
    // Delete test user (cascades to content via createdBy FK)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to remaining members, invitations)
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
