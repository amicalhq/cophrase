import { test, expect } from "@playwright/test"
import { db, eq, user, organization } from "@workspace/db"

test.describe("Unauthenticated user", () => {
  test("is redirected to sign-in and sees the login form", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveURL(/\/sign-in/)

    await expect(page.locator("[data-slot='card-title']")).toHaveText("Sign in")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Sign in" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible()
  })

  test("can navigate to sign-up page", async ({ page }) => {
    await page.goto("/sign-in")

    await page.getByRole("link", { name: "Sign up" }).click()

    await expect(page).toHaveURL(/\/sign-up/)
    await expect(page.locator("[data-slot='card-title']")).toHaveText(
      "Create an account"
    )
    await expect(page.getByLabel("Name")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
  })
})

test.describe.serial("Auth flow", () => {
  const testId = Date.now()
  const testUser = {
    name: "Test User",
    email: `test-${testId}@example.com`,
    password: "testpassword123",
    orgName: `Test Organization ${testId}`,
  }

  test("can sign up, create org, and land on home", async ({ page }) => {
    await page.goto("/sign-up")

    await page.getByLabel("Name").fill(testUser.name)
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Create account" }).click()

    // Should redirect to org setup
    await expect(page).toHaveURL(/\/sign-up\/org/, { timeout: 10_000 })
    await expect(page.locator("[data-slot='card-title']")).toHaveText(
      "Set up your organization"
    )

    await page.getByLabel("Organization name").fill(testUser.orgName)
    await page.getByRole("button", { name: "Continue" }).click()

    // Should land on authenticated home
    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await expect(page.getByText("Welcome to CoPhrase.")).toBeVisible()
  })

  test("can sign out from home page", async ({ page }) => {
    // Sign in first
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await expect(page.getByText("Welcome to CoPhrase.")).toBeVisible()

    // Open user menu and sign out
    await page.locator("[data-slot='avatar']").click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 })
    await expect(page.locator("[data-slot='card-title']")).toHaveText("Sign in")
  })

  test("can sign in with existing account", async ({ page }) => {
    await page.goto("/sign-in")

    await page.getByLabel("Email").fill(testUser.email)
    await page.getByLabel("Password").fill(testUser.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await expect(page.getByText("Welcome to CoPhrase.")).toBeVisible()
    await expect(page.getByText(testUser.orgName)).toBeVisible()
  })

  test.afterAll(async () => {
    // Delete test user (cascades to sessions, accounts, members)
    await db.delete(user).where(eq(user.email, testUser.email))
    // Delete test org (cascades to remaining members, invitations)
    await db.delete(organization).where(eq(organization.name, testUser.orgName))
  })
})
