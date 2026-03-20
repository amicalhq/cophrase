import { test, expect } from "@playwright/test"

test.describe.serial("Content formats", () => {
  const testId = Date.now()
  const testUser = {
    name: "Formats Test User",
    email: `formats-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Formats Test Org ${testId}`,
  }
  let orgId = ""
  let projectId = ""

  test("setup: sign up, create org and project", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill(testUser.name)
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/sign-up\/org/, { timeout: 10_000 })
    await page.getByLabel("Organization name").fill(testUser.orgName)
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

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
    await page.getByLabel("Name").fill(`Formats Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()
    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })
    projectId = page.url().match(/\/projects\/([^/]+)/)![1]!
  })

  test("plain_text format renders textarea editor", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const ctRes = await page.request.post("/api/content-types/create", {
      data: {
        projectId, orgId, name: "Test Tweet", format: "plain_text",
        frontmatterSchema: { type: "object", properties: { hashtags: { type: "string" } } },
        stages: [{ name: "Draft", position: 1 }],
      },
    })
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "Test Tweet", contentTypeId: ct.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.getByPlaceholder(/content will appear/i)).toBeVisible({ timeout: 10_000 })
  })

  test("image format renders image viewer", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const ctRes = await page.request.post("/api/content-types/create", {
      data: {
        projectId, orgId, name: "Test Banner", format: "image",
        stages: [{ name: "Generate", position: 1 }],
      },
    })
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "Test Banner", contentTypeId: ct.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.getByText(/no image artifact yet/i)).toBeVisible({ timeout: 10_000 })
  })

  test("video format renders video viewer", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const ctRes = await page.request.post("/api/content-types/create", {
      data: {
        projectId, orgId, name: "Test Clip", format: "video",
        stages: [{ name: "Produce", position: 1 }],
      },
    })
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "Test Clip", contentTypeId: ct.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.getByText(/no video artifact yet/i)).toBeVisible({ timeout: 10_000 })
  })

  test("deck format renders deck viewer", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const ctRes = await page.request.post("/api/content-types/create", {
      data: {
        projectId, orgId, name: "Test Deck", format: "deck",
        stages: [{ name: "Outline", position: 1 }],
      },
    })
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "Test Deck", contentTypeId: ct.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.getByText(/no deck artifact yet/i)).toBeVisible({ timeout: 10_000 })
  })

  test("rich_text format still renders Tiptap editor", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const ctRes = await page.request.post("/api/content-types/create", {
      data: {
        projectId, orgId, name: "Test Article", format: "rich_text",
        stages: [{ name: "Write", position: 1 }],
      },
    })
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "Test Article", contentTypeId: ct.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 10_000 })
  })

  test("frontmatter fields render for non-rich-text formats", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // The plain_text "Test Tweet" has frontmatter with "hashtags" field
    const typesRes = await page.request.get(`/api/content-types?projectId=${projectId}&orgId=${orgId}`)
    const types = await typesRes.json()
    const tweetType = types.find((t: { name: string }) => t.name === "Test Tweet")
    expect(tweetType).toBeTruthy()

    const contentRes = await page.request.post("/api/content", {
      data: { projectId, orgId, title: "FM Test Tweet", contentTypeId: tweetType.id },
    })
    expect(contentRes.ok()).toBeTruthy()
    const content = await contentRes.json()

    await page.goto(`/orgs/${orgId}/projects/${projectId}/content/${content.id}/edit`)
    await expect(page.getByText("Details")).toBeVisible({ timeout: 10_000 })
  })
})
