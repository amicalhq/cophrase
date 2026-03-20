import { test, expect } from "@playwright/test"

test.describe.serial("Dynamic harness", () => {
  const testId = Date.now()
  const testUser = {
    name: "Harness Test User",
    email: `harness-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Harness Test Org ${testId}`,
  }
  let orgId = ""
  let projectId = ""
  let contentId = ""
  let blogTypeId = ""

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
    await page.getByLabel("Name").fill(`Harness Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()

    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })

    const projectUrl = page.url()
    const projMatch = projectUrl.match(/\/projects\/([^/]+)/)
    expect(projMatch).toBeTruthy()
    projectId = projMatch![1]!
  })

  test("setup: install Blog Post content type", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const templatesRes = await page.request.get("/api/content-types/templates")
    expect(templatesRes.ok()).toBeTruthy()
    const templates = await templatesRes.json()
    const blogTemplate = templates.find(
      (t: { name: string }) => t.name === "Blog Post",
    )
    expect(blogTemplate).toBeTruthy()

    const installRes = await page.request.post("/api/content-types/install", {
      data: { templateId: blogTemplate.id, projectId, orgId },
    })
    expect(installRes.ok()).toBeTruthy()
    const installed = await installRes.json()
    blogTypeId = installed.id
    expect(blogTypeId).toBeTruthy()
  })

  test("setup: configure AI provider", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const apiKey = process.env.OPENAI_API_KEY_DEV
    expect(apiKey).toBeTruthy()

    const providerRes = await page.request.post("/api/providers", {
      data: {
        orgId,
        name: "OpenAI Test",
        providerType: "openai",
        apiKey,
        models: [
          { modelId: "gpt-4.1-nano", modelType: "language" },
        ],
      },
    })
    expect(providerRes.ok()).toBeTruthy()
    const providerData = await providerRes.json()
    expect(providerData.provider.id).toBeTruthy()
    expect(providerData.models.length).toBe(1)
  })

  test("setup: create content piece", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const createRes = await page.request.post("/api/content", {
      data: {
        projectId,
        orgId,
        title: "Harness E2E Test Post",
        contentTypeId: blogTypeId,
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const content = await createRes.json()
    contentId = content.id
    expect(contentId).toBeTruthy()
  })

  test("suggestions API returns stage-based suggestions", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const res = await page.request.get(
      `/api/content/${contentId}/suggestions`,
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.suggestions).toBeDefined()
    expect(data.suggestions.length).toBeGreaterThan(0)
    expect(data.suggestions[0].label).toMatch(/Research/i)
    expect(data.suggestions[0].primary).toBe(true)
  })

  test("editor loads with initial suggestions", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    await expect(page.getByPlaceholder(/ask the ai agent/i)).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText(/Start Research/i)).toBeVisible({
      timeout: 5000,
    })
  })

  test("chat: send message and get Content Agent response", async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(
      `/orgs/${orgId}/projects/${projectId}/content/${contentId}/edit`,
    )

    await expect(page.getByPlaceholder(/ask the ai agent/i)).toBeVisible({
      timeout: 10_000,
    })

    // Send a message
    await page.getByPlaceholder(/ask the ai agent/i).fill(
      "What stages are available for this blog post?",
    )
    await page.getByPlaceholder(/ask the ai agent/i).press("Enter")

    // Wait for assistant response containing stage names (LLM call — may take a while)
    // The Content Agent should mention the pipeline stages in its response
    await expect(
      page.getByText(/Research.*Draft.*Refine/i),
    ).toBeVisible({ timeout: 90_000 })
  })

  test("content type has DB-driven stages", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const typesRes = await page.request.get(
      `/api/content-types?projectId=${projectId}&orgId=${orgId}`,
    )
    expect(typesRes.ok()).toBeTruthy()
    const types = await typesRes.json()
    const blogType = types.find(
      (t: { name: string }) => t.name === "Blog Post",
    )
    expect(blogType).toBeTruthy()
    expect(blogType.stages).toBeDefined()
    expect(blogType.stages.length).toBeGreaterThan(0)
  })
})
