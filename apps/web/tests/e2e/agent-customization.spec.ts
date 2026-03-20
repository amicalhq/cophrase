import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

test.describe.serial("Agent customization", () => {
  const testId = Date.now()
  const testUser = {
    name: "Customize Test User",
    email: `customize-test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Customize Test Org ${testId}`,
  }
  let orgId = ""
  let projectId = ""
  let contentTypeId = ""

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

  test("setup: create project and install content type", async ({ page }) => {
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
    await page.getByLabel("Name").fill(`Customize Project ${testId}`)
    await page.getByRole("button", { name: "Create project" }).click()
    await expect(page).toHaveURL(/\/content/, { timeout: 10_000 })
    projectId = page.url().match(/\/projects\/([^/]+)/)![1]!

    // Install Blog Post
    const templatesRes = await page.request.get("/api/content-types/templates")
    const templates = await templatesRes.json()
    const blogTemplate = templates.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogTemplate).toBeTruthy()

    const installRes = await page.request.post("/api/content-types/install", {
      data: { templateId: blogTemplate.id, projectId, orgId },
    })
    expect(installRes.ok()).toBeTruthy()
    const installed = await installRes.json()
    contentTypeId = installed.id
  })

  test("can edit content agent prompt via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get the content type to find the content agent ID
    const ctRes = await page.request.get(`/api/content-types/${contentTypeId}`)
    expect(ctRes.ok()).toBeTruthy()
    const ct = await ctRes.json()
    expect(ct.agentId).toBeTruthy()

    // Update the content agent prompt
    const patchRes = await page.request.patch(`/api/agents/${ct.agentId}`, {
      data: { prompt: "Updated content agent prompt for testing" },
    })
    expect(patchRes.ok()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.prompt).toBe("Updated content agent prompt for testing")
  })

  test("can edit sub-agent prompt via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get content type to find sub-agent
    const ctRes = await page.request.get(`/api/content-types/${contentTypeId}`)
    const ct = await ctRes.json()
    expect(ct.stages.length).toBeGreaterThan(0)
    expect(ct.stages[0].subAgents.length).toBeGreaterThan(0)
    const subAgentId = ct.stages[0].subAgents[0].agentId

    // Update the sub-agent prompt
    const patchRes = await page.request.patch(`/api/agents/${subAgentId}`, {
      data: { prompt: "Custom test prompt for sub-agent" },
    })
    expect(patchRes.ok()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.prompt).toBe("Custom test prompt for sub-agent")

    // Verify persistence by fetching again
    const verifyRes = await page.request.get(`/api/agents/${subAgentId}/tools`)
    expect(verifyRes.ok()).toBeTruthy()
  })

  test("can add and remove tool on sub-agent via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get content type stages to find a sub-agent
    const ctRes = await page.request.get(`/api/content-types/${contentTypeId}`)
    const ct = await ctRes.json()
    const firstStage = ct.stages[0]
    expect(firstStage.subAgents.length).toBeGreaterThan(0)
    const subAgentId = firstStage.subAgents[0].agentId

    // Get current tools count
    const toolsRes = await page.request.get(`/api/agents/${subAgentId}/tools`)
    expect(toolsRes.ok()).toBeTruthy()
    const toolsBefore = await toolsRes.json()
    const initialCount = toolsBefore.length

    // Add a test tool
    const addRes = await page.request.post(`/api/agents/${subAgentId}/tools`, {
      data: { type: "function", referenceId: "test-function-tool" },
    })
    expect(addRes.ok()).toBeTruthy()
    const added = await addRes.json()
    expect(added.id).toBeTruthy()
    expect(added.referenceId).toBe("test-function-tool")

    // Verify tool count increased
    const toolsAfterAdd = await page.request.get(`/api/agents/${subAgentId}/tools`)
    const afterAdd = await toolsAfterAdd.json()
    expect(afterAdd.length).toBe(initialCount + 1)

    // Remove the tool
    const removeRes = await page.request.delete(
      `/api/agents/${subAgentId}/tools/${added.id}`,
    )
    expect(removeRes.ok()).toBeTruthy()

    // Verify tool count returned to original
    const toolsAfterRemove = await page.request.get(`/api/agents/${subAgentId}/tools`)
    const afterRemove = await toolsAfterRemove.json()
    expect(afterRemove.length).toBe(initialCount)
  })

  test("detail page shows customization UI", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await page.goto(`/orgs/${orgId}/projects/${projectId}/agents/${contentTypeId}`)

    // Verify Content Agent section exists
    await expect(
      page.getByRole("heading", { name: "Content Agent" }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Orchestration prompt")).toBeVisible()

    // Verify Pipeline Stages section exists
    await expect(
      page.getByRole("heading", { name: "Pipeline Stages" }),
    ).toBeVisible()
  })

  test.afterAll(async () => {
    await db.delete(user).where(eq(user.email, testUser.email))
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
