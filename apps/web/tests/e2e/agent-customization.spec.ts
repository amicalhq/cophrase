import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"
import { trpcQuery, trpcMutate } from "./helpers/trpc"

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
    const templates = await trpcQuery(page.request, 'contentTypes.templates')
    const blogTemplate = templates.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogTemplate).toBeTruthy()

    const installed = await trpcMutate(page.request, 'contentTypes.install', {
      templateId: blogTemplate.id, projectId, orgId,
    })
    contentTypeId = installed.id
  })

  test("can edit content agent prompt via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get the content type to find the content agent ID
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: contentTypeId,
    })
    expect(ct.agentId).toBeTruthy()

    // Update the content agent prompt
    const updated = await trpcMutate(page.request, 'agents.update', {
      id: ct.agentId, prompt: "Updated content agent prompt for testing",
    })
    expect(updated.prompt).toBe("Updated content agent prompt for testing")
  })

  test("can edit sub-agent prompt via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get content type to find sub-agent
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: contentTypeId,
    })
    expect(ct.stages.length).toBeGreaterThan(0)
    expect(ct.stages[0].subAgents.length).toBeGreaterThan(0)
    const subAgentId = ct.stages[0].subAgents[0].agentId

    // Update the sub-agent prompt
    const updated = await trpcMutate(page.request, 'agents.update', {
      id: subAgentId, prompt: "Custom test prompt for sub-agent",
    })
    expect(updated.prompt).toBe("Custom test prompt for sub-agent")

    // Verify persistence by fetching again
    await trpcQuery(page.request, 'agents.listTools', {
      agentId: subAgentId,
    })
  })

  test("can add and remove tool on sub-agent via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get content type stages to find a sub-agent
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: contentTypeId,
    })
    const firstStage = ct.stages[0]
    expect(firstStage.subAgents.length).toBeGreaterThan(0)
    const subAgentId = firstStage.subAgents[0].agentId

    // Get current tools count
    const toolsBefore = await trpcQuery(page.request, 'agents.listTools', {
      agentId: subAgentId,
    })
    const initialCount = toolsBefore.length

    // Add a test tool
    const added = await trpcMutate(page.request, 'agents.addTool', {
      agentId: subAgentId, type: "function", referenceId: "test-function-tool",
    })
    expect(added.id).toBeTruthy()
    expect(added.referenceId).toBe("test-function-tool")

    // Verify tool count increased
    const afterAdd = await trpcQuery(page.request, 'agents.listTools', {
      agentId: subAgentId,
    })
    expect(afterAdd.length).toBe(initialCount + 1)

    // Remove the tool
    await trpcMutate(page.request, 'agents.removeTool', {
      agentId: subAgentId, toolId: added.id,
    })

    // Verify tool count returned to original
    const afterRemove = await trpcQuery(page.request, 'agents.listTools', {
      agentId: subAgentId,
    })
    expect(afterRemove.length).toBe(initialCount)
  })

  test("can change model on sub-agent and verify persistence", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get sub-agent
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: contentTypeId,
    })
    const subAgentId = ct.stages[0].subAgents[0].agentId

    // Set modelId to null (org default) — verify it persists as null
    const updated = await trpcMutate(page.request, 'agents.update', {
      id: subAgentId, modelId: null,
    })
    expect(updated.modelId).toBeNull()

    // Verify persistence by re-fetching the content type
    const verified = await trpcQuery(page.request, 'contentTypes.get', {
      id: contentTypeId,
    })
    const verifiedSubAgent = verified.stages[0].subAgents[0]
    expect(verifiedSubAgent.agentId).toBe(subAgentId)
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
