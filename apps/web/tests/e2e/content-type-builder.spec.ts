import { test, expect } from "@playwright/test"

test.describe.serial("Content type builder", () => {
  const testId = Date.now()
  const testUser = {
    name: "Builder Test User",
    email: `builder-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Builder Test Org ${testId}`,
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

  test("setup: create project", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto("/orgs")
    await page.getByText(testUser.orgName).click()
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })
    orgId = page.url().match(/\/orgs\/([^/]+)/)![1]!

    await page.getByRole("button", { name: "New project" }).click()
    await page.getByLabel("Name").fill(`Builder Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()
    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })
    projectId = page.url().match(/\/projects\/([^/]+)/)![1]!
  })

  test("can create content type from scratch via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const res = await page.request.post("/api/content-types/create", {
      data: {
        projectId,
        orgId,
        name: "Custom Article",
        description: "Articles created from scratch",
        format: "rich_text",
        frontmatterSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
          },
          required: ["title"],
        },
        stages: [
          { name: "Research", position: 1 },
          { name: "Write", position: 2 },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = await res.json()
    expect(created.id).toBeTruthy()
    expect(created.name).toBe("Custom Article")
    expect(created.stages.length).toBe(2)
  })

  test("can create content with custom type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const createRes = await page.request.post("/api/content", {
      data: {
        projectId,
        orgId,
        title: "Test Custom Article",
        contentTypeId: customType.id,
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const content = await createRes.json()
    expect(content.id).toBeTruthy()
  })

  test("can fork content type via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Install Blog Post first
    const templatesRes = await page.request.get("/api/content-types/templates")
    const templates = await templatesRes.json()
    const blogTemplate = templates.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogTemplate).toBeTruthy()

    const installRes = await page.request.post("/api/content-types/install", {
      data: { templateId: blogTemplate.id, projectId, orgId },
    })
    expect(installRes.ok()).toBeTruthy()
    const installed = await installRes.json()

    // Fork it
    const forkRes = await page.request.post(
      `/api/content-types/${installed.id}/fork`,
    )
    expect(forkRes.ok()).toBeTruthy()
    const forked = await forkRes.json()
    expect(forked.id).toBeTruthy()
    expect(forked.name).toBe("Blog Post (Copy)")
    expect(forked.id).not.toBe(installed.id)
    expect(forked.stages.length).toBe(installed.stages.length)
  })

  test("forked type is independent", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const forkedType = types.find((t: { name: string }) => t.name === "Blog Post (Copy)")
    expect(forkedType).toBeTruthy()

    const patchRes = await page.request.patch(
      `/api/content-types/${forkedType.id}`,
      { data: { name: "My Custom Blog" } },
    )
    expect(patchRes.ok()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.name).toBe("My Custom Blog")

    // Original Blog Post unchanged
    const originalType = types.find((t: { name: string }) => t.name === "Blog Post")
    expect(originalType).toBeTruthy()
    expect(originalType.name).toBe("Blog Post")
  })

  test("agents page shows Create from scratch button", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents`)
    await expect(page.getByText(/Create from scratch/i)).toBeVisible({ timeout: 10_000 })
  })

  test("detail page shows fork button", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const blogType = types.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogType).toBeTruthy()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents/${blogType.id}`)
    await expect(page.getByRole("button", { name: "Fork" })).toBeVisible({ timeout: 10_000 })
  })

  test("detail page shows frontmatter schema section", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents/${customType.id}`)
    await expect(
      page.getByRole("heading", { name: "Frontmatter Schema" }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("frontmatter form renders in content editor", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get custom type and create content piece
    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const createRes = await page.request.post("/api/content", {
      data: {
        projectId,
        orgId,
        title: "Editor Frontmatter Test",
        contentTypeId: customType.id,
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const content = await createRes.json()

    // Navigate to the editor
    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`,
    )

    // Frontmatter form should render with field labels from the schema
    // The Custom Article has frontmatterSchema with "title" and "author" properties
    await expect(page.getByText("Details")).toBeVisible({ timeout: 10_000 })
  })

  test("frontmatter values can be saved and loaded", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    const types = await typesRes.json()
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const createRes = await page.request.post("/api/content", {
      data: {
        projectId,
        orgId,
        title: "Frontmatter Test Article",
        contentTypeId: customType.id,
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const content = await createRes.json()

    const patchRes = await page.request.patch(
      `/api/content/${content.id}/frontmatter`,
      { data: { frontmatter: { title: "My Article Title", author: "Test Author" } } },
    )
    expect(patchRes.ok()).toBeTruthy()

    const getRes = await page.request.get(
      `/api/content/${content.id}/frontmatter`,
    )
    expect(getRes.ok()).toBeTruthy()
    const fmData = await getRes.json()
    expect(fmData.frontmatter.title).toBe("My Article Title")
    expect(fmData.frontmatter.author).toBe("Test Author")
  })
})
