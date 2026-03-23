import { test, expect } from "@playwright/test"
import { trpcQuery, trpcMutate } from "./helpers/trpc"

test.describe.serial("Resources", () => {
  const testId = Date.now()
  const testUser = {
    name: "Resources Test User",
    email: `resources-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Resources Test Org ${testId}`,
    projectName: `Test Project ${testId}`,
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
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })
  })

  test("setup: create a project", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

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
    await page.getByLabel("Name").fill(testUser.projectName)
    await page.getByRole("button", { name: "Create project" }).click()

    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })

    // Extract projectId from URL
    const projectUrl = page.url()
    const projMatch = projectUrl.match(/\/projects\/([^/]+)/)
    expect(projMatch).toBeTruthy()
    projectId = projMatch![1]!
  })

  test("resources tab is visible in project navigation", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content`)

    await expect(
      page.getByRole("link", { name: "Resources", exact: true })
    ).toBeVisible()
  })

  test("resources page shows empty state", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await expect(page.getByText("No resources found")).toBeVisible()
  })

  test("create a text resource", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await page.getByRole("button", { name: "Add resource" }).click()

    // Fill form: category first, then type, then title, then content
    await page.getByText("Select a category").click()
    await page.getByRole("option", { name: "Brand Voice" }).click()
    await page.getByRole("button", { name: "Text" }).click()
    await page.getByLabel("Title").fill("Tone Guidelines")
    await page
      .locator(".ProseMirror")
      .fill("Our brand speaks with warmth and clarity.")

    await page.getByRole("button", { name: "Create" }).click()

    // Verify card appears
    await expect(page.getByText("Tone Guidelines")).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page
        .locator("[data-testid='resource-card']")
        .filter({ hasText: "Brand Voice" })
    ).toBeVisible()
  })

  test("can get a single resource via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    // List resources to get the text resource ID
    const resources = await trpcQuery(page.request, 'resources.list', {
      orgId, projectId,
    })
    const toneResource = resources.find(
      (r: { title: string }) => r.title === "Tone Guidelines",
    )
    expect(toneResource).toBeTruthy()

    // Get a single resource
    const result = await trpcQuery(page.request, 'resources.get', {
      orgId, projectId,
      id: toneResource.id,
    })
    expect(result.title).toBe("Tone Guidelines")
    expect(result.type).toBe("text")
    expect(result.category).toBe("brand_voice")
    expect(result.content).toBeTruthy()
  })

  test("create a link resource", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await page.getByRole("button", { name: "Add resource" }).click()
    await page.getByText("Select a category").click()
    await page.getByRole("option", { name: "Website" }).click()
    await page.getByRole("button", { name: "Link" }).click()
    await page.getByLabel("Title").fill("Marketing Site")
    await page.getByLabel("URL").fill("https://example.com")

    await page.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Marketing Site")).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page
        .locator("[data-testid='resource-card']")
        .filter({ hasText: "Website" })
    ).toBeVisible()
  })

  test("filter resources by type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    // Both resources should be visible
    await expect(page.getByText("Tone Guidelines")).toBeVisible()
    await expect(page.getByText("Marketing Site")).toBeVisible()

    // Filter by text type
    await page.getByText("All Types").click()
    await page.getByRole("option", { name: "Text" }).click()

    await expect(page.getByText("Tone Guidelines")).toBeVisible()
    await expect(page.getByText("Marketing Site")).not.toBeVisible()
  })

  test("filter resources by category", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    // Filter by Website category
    await page.getByText("All Categories").click()
    await page.getByRole("option", { name: "Website" }).click()

    await expect(page.getByText("Marketing Site")).toBeVisible()
    await expect(page.getByText("Tone Guidelines")).not.toBeVisible()
  })

  test("search resources by title", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await page.getByPlaceholder("Search resources...").fill("Marketing")

    await expect(page.getByText("Marketing Site")).toBeVisible()
    await expect(page.getByText("Tone Guidelines")).not.toBeVisible()
  })

  test("edit a resource title", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    // Click on a resource card to open edit dialog
    await page.getByText("Marketing Site").click()

    // Edit title
    await page.getByLabel("Title").clear()
    await page.getByLabel("Title").fill("Company Website")

    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Company Website")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("delete a resource", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    // Click on a resource card to open edit dialog
    await page.getByText("Company Website").click()

    // Delete from dialog
    await page.getByRole("button", { name: "Delete" }).click()

    // Confirm deletion
    await page.getByRole("button", { name: "Confirm" }).click()

    // Verify card is removed
    await expect(page.getByText("Company Website")).not.toBeVisible({
      timeout: 5_000,
    })
  })

  test("create resource with new category (SEO Guidelines)", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await page.getByRole("button", { name: "Add resource" }).click()

    // Select "SEO Guidelines" category
    await page.getByText("Select a category").click()
    await page.getByRole("option", { name: "SEO Guidelines" }).click()

    // Select "Text" type
    await page.getByRole("button", { name: "Text" }).click()

    // Fill title
    await page.getByLabel("Title").fill("On-Page SEO Rules")

    // Fill content in ProseMirror
    await page
      .locator(".ProseMirror")
      .fill("Always include primary keyword in H1")

    await page.getByRole("button", { name: "Create" }).click()

    // Verify card appears with title
    await expect(page.getByText("On-Page SEO Rules")).toBeVisible({
      timeout: 5_000,
    })

    // Verify card shows "SEO Guidelines" category badge
    await expect(
      page
        .locator("[data-testid='resource-card']")
        .filter({ hasText: "SEO Guidelines" })
    ).toBeVisible()
  })

  test("API: list resources returns new categories", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    const resources = await trpcQuery(page.request, "resources.list", {
      orgId,
      projectId,
    })

    // Find the "On-Page SEO Rules" resource and verify its category
    const seoResource = resources.find(
      (r: { title: string }) => r.title === "On-Page SEO Rules"
    )
    expect(seoResource).toBeTruthy()
    expect(seoResource.category).toBe("seo_guidelines")
  })

  test("API: create resource with description via tRPC", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    // Create a resource with description via API
    const created = await trpcMutate(page.request, "resources.create", {
      orgId,
      projectId,
      title: "Voice Guide with Description",
      type: "text",
      category: "brand_voice",
      description: "Defines our brand tone for content agents",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "We write with clarity and warmth." }],
          },
        ],
      },
    })
    expect(created.id).toMatch(/^res_/)

    // Verify description persists via list API
    const resources = await trpcQuery(page.request, "resources.list", {
      orgId,
      projectId,
    })
    const voiceResource = resources.find(
      (r: { title: string }) => r.title === "Voice Guide with Description"
    )
    expect(voiceResource).toBeTruthy()
    expect(voiceResource.description).toBe(
      "Defines our brand tone for content agents"
    )
  })

  test("API: create resource with new category via tRPC", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    const result = await trpcMutate(page.request, "resources.create", {
      orgId,
      projectId,
      title: "Internal Link Map",
      type: "text",
      category: "internal_links",
      description: "Key pages to link to from blog posts",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Link to /pricing from pricing-related content",
              },
            ],
          },
        ],
      },
    })

    // Verify the created resource has the right id format
    expect(result.id).toBeTruthy()
    expect(result.id).toMatch(/^res_/)
  })

  test("create 'Other' resource shows description field", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    await page.getByRole("button", { name: "Add resource" }).click()

    // Description field should not be visible for a predefined category
    await page.getByText("Select a category").click()
    await page.getByRole("option", { name: "Brand Voice" }).click()
    await page.getByRole("button", { name: "Text" }).click()
    await expect(page.getByLabel("Description")).not.toBeVisible()

    // Switch to "Other" — description field should appear
    await page
      .getByRole("combobox")
      .filter({ hasText: "Brand Voice" })
      .click()
    await page.getByRole("option", { name: "Other" }).click()

    await expect(page.getByLabel("Description")).toBeVisible()

    // Fill the form
    await page.getByLabel("Title").fill("Custom Resource")
    await page.getByLabel("Description").fill("A custom category resource")
    await page.locator(".ProseMirror").fill("Custom content here.")

    await page.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Custom Resource")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("'Other' resource description persists on edit", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/(orgs)?$/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/resources`)

    // Open the resource we just created
    await page.getByText("Custom Resource").click()

    // Description should be populated in the edit dialog
    await expect(page.getByLabel("Description")).toBeVisible()
    await expect(page.getByLabel("Description")).toHaveValue(
      "A custom category resource"
    )
  })
})
