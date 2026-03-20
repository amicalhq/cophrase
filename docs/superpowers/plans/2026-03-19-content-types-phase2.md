# Content Types Phase 2: Installation & Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to install content type templates into projects, manage them via CRUD, and configure stage pipelines through a new "Agents" tab.

**Architecture:** New query functions in `@workspace/db` handle the transactional install flow (copy template → project). API routes use a `withAuth` wrapper to reduce boilerplate. Server components fetch data and pass to client components for the Agents page UI.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, PostgreSQL, shadcn/ui, Playwright E2E tests

**Spec:** `docs/superpowers/specs/2026-03-19-content-types-phase2-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/lib/api/with-auth.ts` | Auth wrapper utility (`withSessionAuth`, `withOrgAuth`, `withResourceAuth`) |
| `apps/web/app/api/content-types/route.ts` | `GET` list content types by projectId |
| `apps/web/app/api/content-types/templates/route.ts` | `GET` app-scoped templates |
| `apps/web/app/api/content-types/install/route.ts` | `POST` install template into project |
| `apps/web/app/api/content-types/[id]/route.ts` | `GET`, `PATCH`, `DELETE` content type |
| `apps/web/app/api/content-types/[id]/stages/route.ts` | `POST` add stage |
| `apps/web/app/api/content-types/[id]/stages/reorder/route.ts` | `POST` reorder stages |
| `apps/web/app/api/content-types/[id]/stages/[stageId]/route.ts` | `PATCH`, `DELETE` stage |
| `apps/web/app/api/content-types/[id]/stages/[stageId]/sub-agents/route.ts` | `POST` bind sub-agent |
| `apps/web/app/api/content-types/[id]/stages/[stageId]/sub-agents/[subAgentId]/route.ts` | `DELETE` unbind |
| `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/agents/page.tsx` | Agents list + template gallery (server component) |
| `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/agents/[contentTypeId]/page.tsx` | Content type detail (server component) |
| `apps/web/components/agents/template-gallery.tsx` | Template card grid (client) |
| `apps/web/components/agents/installed-content-types.tsx` | Installed types list (client) |
| `apps/web/components/agents/content-type-detail.tsx` | Detail/edit view (client) |
| `apps/web/components/agents/stage-list.tsx` | Stages ordered list with sub-agents (client) |
| `apps/web/components/agents/install-button.tsx` | Install action button (client) |
| `apps/web/tests/e2e/agents.spec.ts` | Phase 2 E2E tests |

### Modified files

| File | Change |
|------|--------|
| `packages/db/src/queries/content-types.ts` | Add `installContentType`, `updateContentType`, `deleteContentTypeIfUnused`, `addStage`, `updateStage`, `deleteStage`, `reorderStages`, `bindSubAgent`, `unbindSubAgent`; extend `getContentTypesByProject` to include stages |
| `packages/db/package.json` | No change needed — `./queries/content-types` already exported (verify before Task 3) |
| `apps/web/lib/data/content-types.ts` | Add re-exports for new query functions |
| `apps/web/app/orgs/[orgId]/projects/[projectId]/project-layout-client.tsx` | Add "Agents" tab to `projectTabs` |
| `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/content/page.tsx` | Switch from `getAppContentTypes()` to `getContentTypesByProject()`, add empty state |
| `apps/web/components/content/create-content-dialog.tsx` | Handle empty `contentTypes` array gracefully |

---

## Task 1: `withAuth` wrapper utility

**Files:**
- Create: `apps/web/lib/api/with-auth.ts`

- [ ] **Step 1: Create `with-auth.ts`**

Three wrappers that eliminate repeated auth boilerplate from API routes:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { isOrgMember } from "@/lib/data/projects"

type Session = Awaited<ReturnType<typeof auth.api.getSession>> & {}

// Session-only auth (no org context needed)
export function withSessionAuth(
  handler: (req: NextRequest, ctx: { session: NonNullable<Session> }) => Promise<NextResponse>,
) {
  return async (req: NextRequest) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return handler(req, { session })
  }
}

// Auth with orgId from query or body
export function withOrgAuth(
  handler: (req: NextRequest, ctx: { session: NonNullable<Session>; orgId: string }) => Promise<NextResponse>,
  opts: { orgIdFrom: "body" | "query" } = { orgIdFrom: "query" },
) {
  return async (req: NextRequest) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let orgId: string | null = null
    if (opts.orgIdFrom === "query") {
      orgId = req.nextUrl.searchParams.get("orgId")
    } else {
      // Clone request so body can be re-read by handler
      const cloned = req.clone()
      try {
        const body = await cloned.json()
        orgId = body?.orgId ?? null
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 })
    }

    const isMember = await isOrgMember(session.user.id, orgId)
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return handler(req, { session, orgId })
  }
}

// Auth with route params passed through (resource-level auth done by handler)
export function withResourceAuth(
  handler: (req: NextRequest, ctx: { session: NonNullable<Session>; params: Record<string, string> }) => Promise<NextResponse>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }) => {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const params = await routeCtx.params
    return handler(req, { session, params })
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add apps/web/lib/api/with-auth.ts
git commit -m "feat: add withAuth API route wrapper utility"
```

---

## Task 2: Install and CRUD query functions

**Files:**
- Modify: `packages/db/src/queries/content-types.ts`
- Modify: `packages/db/src/index.ts` (if `inArray` not already exported — it is)

Add all new query functions needed for Phase 2. This is the core data layer.

- [ ] **Step 1: Add `installContentType` function**

Add to `packages/db/src/queries/content-types.ts`. Imports needed: `sql` from `drizzle-orm`, `agentTool` from `../schema/agents`, `createAgentId` from `@workspace/id`, plus existing imports.

The function runs a single transaction that copies the entire template tree. See spec "Install Flow" section for the exact copy order. Key points:
- Use `db.transaction(async (tx) => { ... })` for atomicity
- Fresh IDs via ID generators for every copied row
- Build `stageIdMap: Map<oldStageId, newStageId>` to wire up sub-agent join rows to new stages
- Copy agent fields: name, description, prompt, modelId, inputSchema, outputSchema, executionMode, approvalSteps
- Copy agentTool fields: type, referenceId, required, config
- Return result of `getContentTypeWithStages(newContentTypeId)` after the transaction

- [ ] **Step 2: Add `updateContentType` function**

```typescript
export async function updateContentType(
  id: string,
  fields: { name?: string; description?: string; frontmatterSchema?: Record<string, unknown> },
) {
  const [updated] = await db
    .update(contentType)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(contentType.id, id))
    .returning()
  return updated ?? null
}
```

- [ ] **Step 3: Add `deleteContentTypeIfUnused` function**

Must: check for referencing content rows first (return `{ error: "in_use" }` if any). Then in a transaction: collect all sub-agent agentIds via stages → sub-agent join rows, delete the content type (cascades stages + join rows), explicitly delete all collected sub-agent agent rows, explicitly delete the content agent row. Return the deleted content type.

- [ ] **Step 4: Add stage CRUD functions**

- `addStage({ contentTypeId, name, position?, optional? })` — query max position, auto-append if position omitted
- `updateStage(id, { name?, optional? })` — partial update
- `deleteStage(id)` — transaction: collect sub-agent agentIds, delete stage (cascades join rows), delete agent rows, null out `content.currentStageId` where it references this stage
- `reorderStages(contentTypeId, stageIds)` — transaction: validate stageIds match all stages, set positions to negative temps (`-index - 1`), then set final positions (`index + 1`)

- [ ] **Step 5: Add sub-agent binding functions**

- `bindSubAgent({ stageId, agentId, executionOrder? })` — wraps existing `createSubAgent`
- `unbindSubAgent(id)` — read join row to get agentId, delete join row, delete agent row

- [ ] **Step 6: Extend `getContentTypesByProject` to include stages**

Update to return content types with their stages (for pipeline visualization). Use a post-fetch approach: query content types, then query all stages for those IDs, group by contentTypeId.

- [ ] **Step 7: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```
git add packages/db/src/queries/content-types.ts
git commit -m "feat: add install, CRUD, and stage management query functions"
```

---

## Task 3: Update data wrappers and package exports

**Files:**
- Modify: `apps/web/lib/data/content-types.ts`

- [ ] **Step 1: Add re-exports for new functions**

```typescript
export {
  getAppContentTypes,
  getContentTypesByProject,
  getContentTypeWithStages,
  getContentTypeById,
  installContentType,
  updateContentType,
  deleteContentTypeIfUnused,
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  bindSubAgent,
  unbindSubAgent,
} from "@workspace/db/queries/content-types"
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add apps/web/lib/data/content-types.ts
git commit -m "feat: export new content type query functions from data wrapper"
```

---

## Task 4: API routes — Templates and Install

**Files:**
- Create: `apps/web/app/api/content-types/templates/route.ts`
- Create: `apps/web/app/api/content-types/install/route.ts`

- [ ] **Step 1: Create templates route**

`GET /api/content-types/templates` — returns app-scoped content types with stages. Uses `withSessionAuth`.

```typescript
import { NextResponse } from "next/server"
import { withSessionAuth } from "@/lib/api/with-auth"
import { getAppContentTypes, getStagesByContentType } from "@/lib/data/content-types"

export const GET = withSessionAuth(async (_req, { session: _session }) => {
  const templates = await getAppContentTypes()
  const templatesWithStages = await Promise.all(
    templates.map(async (t) => {
      const stages = await getStagesByContentType(t.id)
      return { ...t, stages: stages.map((s) => ({ id: s.id, name: s.name, position: s.position })) }
    }),
  )
  return NextResponse.json(templatesWithStages)
})
```

- [ ] **Step 2: Create install route**

`POST /api/content-types/install` — body: `{ templateId, projectId, orgId }`. Uses `withOrgAuth({ orgIdFrom: "body" })`. Validates templateId exists and is app-scoped. Calls `installContentType`. Returns 201 with the new content type.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add apps/web/app/api/content-types/templates/route.ts apps/web/app/api/content-types/install/route.ts
git commit -m "feat: add templates and install API routes"
```

---

## Task 5: API routes — Content type CRUD

**Files:**
- Create: `apps/web/app/api/content-types/route.ts`
- Create: `apps/web/app/api/content-types/[id]/route.ts`

- [ ] **Step 1: Create list route**

`GET /api/content-types?projectId=X&orgId=Y` — uses `withOrgAuth({ orgIdFrom: "query" })`. Validates projectId from query params. Returns project content types with stages.

- [ ] **Step 2: Create `[id]` route with GET, PATCH, DELETE**

All three use `withResourceAuth`. Each handler: fetch content type by `params.id`, check `organizationId` exists (reject app-scoped), call `isOrgMember`, then proceed.

- GET: return `getContentTypeWithStages(id)`
- PATCH: validate body fields (name, description, frontmatterSchema), call `updateContentType`
- DELETE: call `deleteContentTypeIfUnused`, return 409 if in use

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add apps/web/app/api/content-types/route.ts apps/web/app/api/content-types/\[id\]/route.ts
git commit -m "feat: add content type list and CRUD API routes"
```

---

## Task 6: API routes — Stage CRUD and sub-agent binding

**Files:**
- Create: `apps/web/app/api/content-types/[id]/stages/route.ts`
- Create: `apps/web/app/api/content-types/[id]/stages/reorder/route.ts`
- Create: `apps/web/app/api/content-types/[id]/stages/[stageId]/route.ts`
- Create: `apps/web/app/api/content-types/[id]/stages/[stageId]/sub-agents/route.ts`
- Create: `apps/web/app/api/content-types/[id]/stages/[stageId]/sub-agents/[subAgentId]/route.ts`

All routes use `withResourceAuth`. Each handler: fetch parent content type by `params.id`, verify org membership, then proceed with the stage/sub-agent operation.

- [ ] **Step 1: Create stages route (POST add stage)**

Body: `{ name, position?, optional? }`. Calls `addStage`. Returns 201.

- [ ] **Step 2: Create reorder route (POST)**

Body: `{ stageIds: string[] }`. Calls `reorderStages`. Returns 200.

- [ ] **Step 3: Create `[stageId]` route (PATCH, DELETE)**

PATCH: body `{ name?, optional? }`, calls `updateStage`.
DELETE: calls `deleteStage`, returns 200.

- [ ] **Step 4: Create sub-agents route (POST bind)**

Body: `{ agentId, executionOrder? }`. Calls `bindSubAgent`. Returns 201.

- [ ] **Step 5: Create `[subAgentId]` route (DELETE unbind)**

Calls `unbindSubAgent`. Returns 200.

- [ ] **Step 6: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 7: Commit**

```
git add apps/web/app/api/content-types/\[id\]/stages/
git commit -m "feat: add stage CRUD and sub-agent binding API routes"
```

---

## Task 7: Add "Agents" tab to project navigation

**Files:**
- Modify: `apps/web/app/orgs/[orgId]/projects/[projectId]/project-layout-client.tsx`
- Create: `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/agents/page.tsx` (minimal placeholder)

- [ ] **Step 1: Add Agents tab to project layout**

In `project-layout-client.tsx`, add the Agents tab between Content and Resources:

```typescript
const projectTabs = [
  { label: "Content", href: `/orgs/${orgId}/projects/${project.id}/content` },
  { label: "Agents", href: `/orgs/${orgId}/projects/${project.id}/agents` },
  { label: "Resources", href: `/orgs/${orgId}/projects/${project.id}/resources` },
  { label: "Settings", href: `/orgs/${orgId}/projects/${project.id}/settings` },
]
```

- [ ] **Step 2: Create placeholder agents page**

Minimal server component that renders "Agents" heading. This ensures the route works before building the full UI.

```typescript
export default async function AgentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <h1 className="text-xl font-semibold">Agents</h1>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon.</p>
    </main>
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add apps/web/app/orgs/\[orgId\]/projects/\[projectId\]/project-layout-client.tsx
git add apps/web/app/orgs/\[orgId\]/projects/\[projectId\]/\(project-nav\)/agents/page.tsx
git commit -m "feat: add Agents tab to project navigation"
```

---

## Task 8: Agents page — Template gallery and installed list

**Files:**
- Modify: `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/agents/page.tsx`
- Create: `apps/web/components/agents/template-gallery.tsx`
- Create: `apps/web/components/agents/installed-content-types.tsx`
- Create: `apps/web/components/agents/install-button.tsx`

- [ ] **Step 1: Build the server component (agents page)**

Fetches both app templates and project content types. Computes `installedSourceIds`. Passes data to client components. Two-state rendering: if no installed types → show gallery with onboarding message; if installed → show list with "Add from templates" button.

- [ ] **Step 2: Build `template-gallery.tsx`**

Client component. Props: `templates` (with stages), `installedSourceIds: string[]`, `orgId`, `projectId`. Renders card grid. Each card: name, description, format badge, stage pipeline (names joined with " → "). Shows "Install" button or "Installed" badge. Calls `POST /api/content-types/install` on click, then `router.refresh()`.

- [ ] **Step 3: Build `install-button.tsx`**

Client component. Props: `templateId`, `projectId`, `orgId`, `isInstalled`. Handles loading state, error display, calls install API.

- [ ] **Step 4: Build `installed-content-types.tsx`**

Client component. Props: `contentTypes` (with stages), `orgId`, `projectId`. Renders list with name, format badge, stage pipeline visualization. Each row links to `/orgs/${orgId}/projects/${projectId}/agents/${ct.id}`.

- [ ] **Step 5: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 6: Commit**

```
git add apps/web/app/orgs/\[orgId\]/projects/\[projectId\]/\(project-nav\)/agents/page.tsx
git add apps/web/components/agents/
git commit -m "feat: build Agents page with template gallery and installed list"
```

---

## Task 9: Content type detail page

**Files:**
- Create: `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/agents/[contentTypeId]/page.tsx`
- Create: `apps/web/components/agents/content-type-detail.tsx`
- Create: `apps/web/components/agents/stage-list.tsx`

- [ ] **Step 1: Build the server component (detail page)**

Fetches content type with stages via `getContentTypeWithStages(contentTypeId)`. Redirects to agents list if not found. Passes data to client component.

- [ ] **Step 2: Build `stage-list.tsx`**

Client component. Props: stages array (each with name, position, optional flag, sub-agents array). Renders an ordered list. Each stage item shows: position number, name, optional badge (if true), and sub-agent names listed beneath. Read-only for Phase 2 (no add/remove/reorder controls — deferred to Phase 4).

- [ ] **Step 3: Build `content-type-detail.tsx`**

Client component. Composes `StageList`. Shows:
- Header: name, description (read-only for now — inline editing can be added later), format badge
- Stages section using `StageList` component
- "Delete content type" button at bottom (calls `DELETE /api/content-types/[id]`, handles 409 error with message about existing content)

Sub-agent prompt editing and stage add/remove UI are deferred — show read-only data for Phase 2.

- [ ] **Step 4: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add apps/web/app/orgs/\[orgId\]/projects/\[projectId\]/\(project-nav\)/agents/\[contentTypeId\]/
git add apps/web/components/agents/content-type-detail.tsx
git add apps/web/components/agents/stage-list.tsx
git commit -m "feat: add content type detail page with stages and sub-agents"
```

---

## Task 10: Update content page to use project-scoped types

**Files:**
- Modify: `apps/web/app/orgs/[orgId]/projects/[projectId]/(project-nav)/content/page.tsx`
- Modify: `apps/web/components/content/create-content-dialog.tsx`

- [ ] **Step 1: Update content page**

Change `getAppContentTypes()` → `getContentTypesByProject(projectId)`. If the result is empty, don't render `CreateContentDialog` — show a message instead: "No content types configured. Visit the Agents tab to install one." with a link to the Agents tab.

- [ ] **Step 2: Update create content dialog**

Handle empty `contentTypes` array gracefully (shouldn't happen after step 1, but defensive). The dialog already works with dynamic content types from Phase 1.

- [ ] **Step 3: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add apps/web/app/orgs/\[orgId\]/projects/\[projectId\]/\(project-nav\)/content/page.tsx
git add apps/web/components/content/create-content-dialog.tsx
git commit -m "feat: content page uses project-scoped content types with empty state"
```

---

## Task 11: E2E tests

**Files:**
- Create: `apps/web/tests/e2e/agents.spec.ts`

Write Playwright E2E tests following the same serial pattern as `content.spec.ts`.

**IMPORTANT:** Never use if/else patterns — always use `expect()` assertions.

- [ ] **Step 1: Write setup tests**

```
- setup: sign up and create org (same as content.spec.ts pattern)
- setup: create a project
```

- [ ] **Step 2: Write API-level install verification test**

Use `page.request.*` to call API routes directly and verify data integrity:

```
- POST /api/content-types/install with Blog Post template
- GET /api/content-types/[newId] → verify sourceId matches template, agentId is set
- Verify stages have correct names and positions
- Verify sub-agents are bound with correct agentNames
- Verify agent tool bindings were copied (GET agent tools for each sub-agent)
```

- [ ] **Step 3: Write API-level CRUD tests**

```
- PATCH /api/content-types/[id] → update name → GET → verify
- POST /api/content-types/[id]/stages → add stage → verify position auto-appended
- POST /api/content-types/[id]/stages/reorder → reorder → verify new positions
- DELETE /api/content-types/[id]/stages/[stageId] → verify stage and sub-agent agent rows removed
- DELETE /api/content-types/[id] with no content → verify 200 and cascade
- Create content referencing a content type, then DELETE → verify 409
```

- [ ] **Step 4: Write Agents tab navigation test**

```
- Navigate to project → click Agents tab → verify heading visible
- Verify template gallery shows app-scoped templates (e.g. "Blog Post")
```

- [ ] **Step 5: Write install test (browser)**

```
- Click Install on "Blog Post" template
- Verify installed content type appears in list
- Verify stages shown (Research → Draft → Refine)
```

- [ ] **Step 6: Write content type detail test**

```
- Click installed content type → navigate to detail page
- Verify stages listed with sub-agent names
```

- [ ] **Step 7: Write content integration test**

```
- Navigate to Content tab
- Verify "Blog Post" appears in "New content" dialog (project-scoped)
- Create content with this type → verify it appears in table
```

- [ ] **Step 8: Write delete test**

```
- Navigate back to Agents tab → click installed type → delete it
- Verify removed from list
```

- [ ] **Step 9: Write cleanup**

```
test.afterAll: delete test user and org (same as content.spec.ts)
```

- [ ] **Step 10: Run E2E tests**

Run: `pnpm --filter web exec playwright test tests/e2e/agents.spec.ts --reporter=list`
Expected: All tests PASS

- [ ] **Step 11: Fix any failures and re-run**

Iterate until all tests pass. Fix strict mode violations, timing issues, locator ambiguity.

- [ ] **Step 12: Commit**

```
git add apps/web/tests/e2e/agents.spec.ts
git commit -m "test: add E2E tests for content type installation and management"
```

---

## Task 12: Update existing content E2E tests

**Files:**
- Modify: `apps/web/tests/e2e/content.spec.ts`

The content page now requires project-scoped content types. Existing content tests create a fresh project with no installed types, so the "New content" dialog won't appear. Fix by installing content types before content creation tests.

**Seed IDs:** The seed script uses deterministic IDs: `seed_cty_blog` (Blog Post) and `seed_cty_x` (X Post). These are confirmed in `packages/db/src/seed.ts`.

- [ ] **Step 1: Add install step to content test setup**

After the "setup: create a project" test, add a new test that installs content types via the API:

```typescript
test("setup: install content types", async ({ page }) => {
  // Sign in first (same pattern as other tests)
  await page.goto("/sign-in")
  // ... sign in ...

  // Install Blog Post and X Post templates
  const blogRes = await page.request.post("/api/content-types/install", {
    data: { templateId: "seed_cty_blog", projectId, orgId },
  })
  expect(blogRes.ok()).toBeTruthy()

  const xRes = await page.request.post("/api/content-types/install", {
    data: { templateId: "seed_cty_x", projectId, orgId },
  })
  expect(xRes.ok()).toBeTruthy()
})
```

- [ ] **Step 2: Update "content page shows empty state" test**

After Task 10 changes, a project with no installed content types shows "No content types configured" instead of "No content yet". But since Step 1 installs content types before this test runs (serial tests), this test should still work — the empty state is about having no content pieces, not no content types. Verify the test still expects `"No content yet"` and not the new message.

If the test runs after content types are installed, it should see the content table empty state ("No content yet") since there are no content pieces yet.

- [ ] **Step 3: Run existing content E2E tests**

Run: `pnpm --filter web exec playwright test tests/e2e/content.spec.ts --reporter=list`
Expected: All tests PASS

- [ ] **Step 4: Fix any failures**

The content tests may need adjustments since installed content type names might differ from the app-scoped names (installed types are copies). Verify that "Blog Post" and "X Post" still appear correctly in the dialog and table. The names are copied verbatim during install, so they should be identical.

- [ ] **Step 5: Commit**

```
git add apps/web/tests/e2e/content.spec.ts
git commit -m "fix: install content types in content E2E test setup"
```
