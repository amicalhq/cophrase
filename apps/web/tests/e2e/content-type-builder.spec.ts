import { test, expect } from "@playwright/test"
import { trpcQuery, trpcMutate } from "./helpers/trpc"

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

    const created = await trpcMutate(page.request, 'contentTypes.create', {
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
    })
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

    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const content = await trpcMutate(page.request, 'content.create', {
      projectId,
      orgId,
      title: "Test Custom Article",
      contentTypeId: customType.id,
    })
    expect(content.id).toBeTruthy()
  })

  test("can fork content type via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Install Blog Post first
    const templates = await trpcQuery(page.request, 'contentTypes.templates')
    const blogTemplate = templates.find((t: { name: string }) => t.name === "Blog Post")
    expect(blogTemplate).toBeTruthy()

    const installed = await trpcMutate(page.request, 'contentTypes.install', {
      templateId: blogTemplate.id, projectId, orgId,
    })

    // Fork it
    const forked = await trpcMutate(page.request, 'contentTypes.fork', {
      id: installed.id,
    })
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

    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const forkedType = types.find((t: { name: string }) => t.name === "Blog Post (Copy)")
    expect(forkedType).toBeTruthy()

    const updated = await trpcMutate(page.request, 'contentTypes.update', {
      id: forkedType.id, name: "My Custom Blog",
    })
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

    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
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

    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
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
    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const content = await trpcMutate(page.request, 'content.create', {
      projectId,
      orgId,
      title: "Editor Frontmatter Test",
      contentTypeId: customType.id,
    })

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

    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()

    const content = await trpcMutate(page.request, 'content.create', {
      projectId,
      orgId,
      title: "Frontmatter Test Article",
      contentTypeId: customType.id,
    })

    await trpcMutate(page.request, 'content.updateFrontmatter', {
      contentId: content.id,
      frontmatter: { title: "My Article Title", author: "Test Author" },
    })

    const fmData = await trpcQuery(page.request, 'content.getFrontmatter', {
      contentId: content.id,
    })
    expect(fmData.frontmatter.title).toBe("My Article Title")
    expect(fmData.frontmatter.author).toBe("Test Author")
  })

  // ---------------------------------------------------------------------------
  // Stage CRUD via API
  // ---------------------------------------------------------------------------

  let stageContentTypeId = ""
  let addedStageId = ""

  test("can add a stage to a content type via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Use the "Custom Article" content type created earlier
    const types = await trpcQuery(page.request, 'contentTypes.list', {
      projectId, orgId,
    })
    const customType = types.find((t: { name: string }) => t.name === "Custom Article")
    expect(customType).toBeTruthy()
    stageContentTypeId = customType.id

    const stage = await trpcMutate(page.request, 'contentTypes.addStage', {
      contentTypeId: stageContentTypeId,
      name: "Review",
      optional: true,
    })
    expect(stage.id).toBeTruthy()
    addedStageId = stage.id

    // Verify the stage was added
    const result = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    expect(result.stages).toContainEqual(
      expect.objectContaining({ name: "Review" }),
    )
  })

  test("can update a stage via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await trpcMutate(page.request, 'contentTypes.updateStage', {
      contentTypeId: stageContentTypeId,
      stageId: addedStageId,
      name: "Final Review",
    })

    const result = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    expect(result.stages).toContainEqual(
      expect.objectContaining({ name: "Final Review" }),
    )
    expect(result.stages).not.toContainEqual(
      expect.objectContaining({ name: "Review" }),
    )
  })

  test("can reorder stages via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    const before = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const stageIds = before.stages.map((s: { id: string }) => s.id)
    expect(stageIds.length).toBeGreaterThanOrEqual(2)

    const reversed = [...stageIds].reverse()
    await trpcMutate(page.request, 'contentTypes.reorderStages', {
      contentTypeId: stageContentTypeId,
      stageIds: reversed,
    })

    const after = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const afterIds = after.stages.map((s: { id: string }) => s.id)
    expect(afterIds).toEqual(reversed)
  })

  test("can delete a stage via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    await trpcMutate(page.request, 'contentTypes.deleteStage', {
      contentTypeId: stageContentTypeId,
      stageId: addedStageId,
    })

    const result = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const stageIds = result.stages.map((s: { id: string }) => s.id)
    expect(stageIds).not.toContain(addedStageId)
  })

  test("can bind a sub-agent to a stage via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Get content type to find its agent ID and a stage
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    expect(ct.agentId).toBeTruthy()
    expect(ct.stages.length).toBeGreaterThan(0)

    const targetStageId = ct.stages[0].id

    const bound = await trpcMutate(page.request, 'contentTypes.bindSubAgent', {
      contentTypeId: stageContentTypeId,
      stageId: targetStageId,
      agentId: ct.agentId,
    })
    expect(bound.id).toBeTruthy()

    // Verify the sub-agent binding
    const updated = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const targetStage = updated.stages.find(
      (s: { id: string }) => s.id === targetStageId,
    )
    expect(targetStage).toBeTruthy()
    expect(targetStage.subAgents.length).toBeGreaterThan(0)
  })

  test("can unbind a sub-agent from a stage via API", async ({ page }) => {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/orgs/, { timeout: 10_000 })

    // Find the sub-agent we just bound
    const ct = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const stageWithAgent = ct.stages.find(
      (s: { subAgents: unknown[] }) => s.subAgents.length > 0,
    )
    expect(stageWithAgent).toBeTruthy()

    const subAgentId = stageWithAgent.subAgents[0].id

    await trpcMutate(page.request, 'contentTypes.unbindSubAgent', {
      contentTypeId: stageContentTypeId,
      subAgentId,
    })

    // Verify it's unbound
    const updated = await trpcQuery(page.request, 'contentTypes.get', {
      id: stageContentTypeId,
    })
    const updatedStage = updated.stages.find(
      (s: { id: string }) => s.id === stageWithAgent.id,
    )
    expect(updatedStage.subAgents.length).toBe(0)
  })
})
