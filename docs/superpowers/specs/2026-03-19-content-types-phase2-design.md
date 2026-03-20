# Phase 2: Installation & Content Type Management

## Summary

Phase 2 adds the ability to install content type templates into projects, manage installed content types (CRUD), and configure their stage pipelines. A new "Agents" tab at the project level provides the UI surface. A `withAuth` wrapper reduces API route boilerplate.

## Navigation

**Project tabs:** Content | **Agents** | Resources | Settings

The Agents tab lives at `/orgs/[orgId]/projects/[projectId]/agents`.

## Agents Page

### Two-state page

1. **No content types installed** — Shows template gallery with onboarding message: "Install a content type to start creating content with AI agents." Card grid of app-scoped templates.

2. **Content types installed** — Shows installed content types list as primary view. "Add from templates" button opens the template gallery.

### Template gallery

- Card grid of app-scoped templates fetched via server component calling `getAppContentTypes()`
- Each card shows: name, description, format badge (e.g. "Rich Text"), stage names as pipeline (Research → Draft → Refine)
- "Install" button on each card (or "Installed" badge if already installed for this project)
- Already-installed detection: server component fetches both app templates and project content types, passes `installedSourceIds: Set<string>` to the gallery component

### Installed content types list

- List layout showing project-scoped content types
- Each entry: name, format badge, stage pipeline visualization (stage names joined with →)
- Click a row to navigate to detail view at `/orgs/[orgId]/projects/[projectId]/agents/[contentTypeId]`
- "Add from templates" button at top right

### Content type detail page

Route: `/orgs/[orgId]/projects/[projectId]/agents/[contentTypeId]`

- Header: content type name (editable inline), description, format
- Stages section: ordered list showing stage name, position, optional flag
- Each stage shows bound sub-agents with name and description (read-only for Phase 2; prompt editing deferred to Phase 4)
- "Add stage" button at bottom of stage list
- Delete stage button per stage (with confirmation if sub-agents are bound)
- "Delete content type" in a danger zone section (blocked if content pieces reference it)

## API Design

### `withAuth` wrapper

A utility at `apps/web/lib/api/with-auth.ts` that handles session checking. Three variants for different route contexts:

```typescript
// For session-only routes (no org/project context needed)
export function withSessionAuth(
  handler: (req: NextRequest, ctx: { session: Session }) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>

// For routes where orgId comes from the request body or query params
export function withOrgAuth(
  handler: (req: NextRequest, ctx: { session: Session; orgId: string }) => Promise<NextResponse>,
  opts?: { orgIdFrom: "body" | "query" }
): (req: NextRequest) => Promise<NextResponse>

// For resource-based routes where orgId is derived from the resource
// Passes through route params so the handler can access [id], [stageId], etc.
export function withResourceAuth(
  handler: (req: NextRequest, ctx: { session: Session; params: Record<string, string> }) => Promise<NextResponse>
): (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
```

**Auth strategy for `[id]`-based routes:** Since content type CRUD routes (`/api/content-types/[id]`, `.../stages/[stageId]`, etc.) don't have `orgId` in the URL path, they use `withResourceAuth` which only validates the session. The route handler itself fetches the content type by ID, reads its `organizationId`, and calls `isOrgMember()` to authorize. This is the same pattern used in the existing codebase where resources are looked up first and then org membership is checked.

Example:
```typescript
export const PATCH = withResourceAuth(async (req, { session, params }) => {
  const ct = await getContentTypeById(params.id)
  if (!ct) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!ct.organizationId) return NextResponse.json({ error: "Cannot edit app-scoped type" }, { status: 403 })

  const isMember = await isOrgMember(session.user.id, ct.organizationId)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const updated = await updateContentType(id, body)
  return NextResponse.json(updated)
})
```

### Endpoints

**Templates:**
- `GET /api/content-types/templates` — Returns app-scoped content types with stage info. Uses `withSessionAuth` (no org check needed — templates are global).

**Install:**
- `POST /api/content-types/install` — Body: `{ templateId, projectId, orgId }`. Uses `withOrgAuth({ orgIdFrom: "body" })`. Copies entire template tree into project scope. Returns new content type with all children.

**Content type CRUD:**
- `GET /api/content-types?projectId=X&orgId=Y` — List installed content types for a project. Uses `withOrgAuth({ orgIdFrom: "query" })`.
- `GET /api/content-types/[id]` — Full detail with stages and sub-agents. Uses `withResourceAuth` + resource-level org check.
- `PATCH /api/content-types/[id]` — Update name, description, frontmatter schema. Body: partial fields. Uses `withResourceAuth` + resource-level org check.
- `DELETE /api/content-types/[id]` — Delete project-scoped content type. Returns 409 if content pieces reference it. Uses `withResourceAuth` + resource-level org check.

**Stage CRUD:**
- `POST /api/content-types/[id]/stages` — Add stage. Body: `{ name, position?, optional? }`. Auto-appends if no position.
- `PATCH /api/content-types/[id]/stages/[stageId]` — Update name, optional flag.
- `DELETE /api/content-types/[id]/stages/[stageId]` — Remove stage.
- `POST /api/content-types/[id]/stages/reorder` — Batch reorder. Body: `{ stageIds: string[] }`. Returns 400 if stageIds don't match the content type's actual stages.

All stage routes use `withResourceAuth` and derive org membership from the parent content type.

**Sub-agent binding:**
- `POST /api/content-types/[id]/stages/[stageId]/sub-agents` — Bind sub-agent. Body: `{ agentId, executionOrder? }`.
- `DELETE /api/content-types/[id]/stages/[stageId]/sub-agents/[subAgentId]` — Unbind sub-agent and delete the orphaned agent row.

All sub-agent routes use `withResourceAuth` and derive org membership from the parent content type.

## Install Flow (Core Logic)

Function: `installContentType({ templateId, projectId, orgId })` in `packages/db/src/queries/content-types.ts`.

Single database transaction. Copy order (respects FK dependencies):

1. **Copy content agent** — Read template's `contentType.agentId` → agent row. Insert new agent with `scope: "project"`, `projectId`, `organizationId: orgId`, `sourceId: templateAgent.id`. Fresh ID via `createAgentId()`.

2. **Copy content type** — Insert new content type with `scope: "project"`, `projectId`, `organizationId: orgId`, `sourceId: templateId`, `agentId: newAgent.id`. Copy name, description, format, frontmatterSchema, icon. Fresh ID via `createContentTypeId()`.

3. **Copy stages** — For each template stage (ordered by position): insert new stage with `contentTypeId: newContentType.id`, same name, description, position, optional. Fresh IDs. Build a `stageIdMap: Map<oldStageId, newStageId>`.

4. **Copy sub-agents** — For each template sub-agent join row:
   a. Read the template sub-agent's agent row
   b. Insert new agent with `scope: "project"`, `projectId`, `organizationId: orgId`, `sourceId: templateSubAgent.agentId`
   c. Insert sub-agent join row: `stageId: stageIdMap.get(oldStageId)`, `agentId: newAgent.id`, same executionOrder

5. **Copy agent tools** — For each copied sub-agent: read the template agent's `agentTool` rows, insert copies with `agentId: newSubAgent.id`, same type, referenceId, required, config.

Returns the new content type with all stages and sub-agents (same shape as `getContentTypeWithStages`).

### ID Mapping

```
Template Agent (content agent)  →  New Agent (sourceId → template)
Template Content Type           →  New Content Type (sourceId → template, agentId → new agent)
Template Stage 1                →  New Stage 1 (same position)
Template Stage 2                →  New Stage 2 (same position)
Template SubAgent (stage 1)     →  New Agent + New SubAgent join row
Template SubAgent (stage 2)     →  New Agent + New SubAgent join row
Template AgentTool rows         →  New AgentTool rows (agentId → new sub-agent)
```

## Query Functions

New functions in `packages/db/src/queries/content-types.ts`:

- `installContentType({ templateId, projectId, orgId })` — Transactional copy (described above)
- `getContentTypesByProject(projectId)` — **Already exists.** Extend to include stage count via a subquery or post-fetch count.
- `updateContentType(id, fields)` — Partial update (name, description, frontmatterSchema)
- `deleteContentTypeIfUnused(id)` — Check for referencing content rows (return error if any exist). Within a transaction: collect all sub-agent `agentId`s via stages, delete the content type row (cascades stages + sub-agent join rows), explicitly delete all collected sub-agent `agent` rows, explicitly delete the content agent `agent` row (`contentType.agentId`). The DB cascades `contentTypeStage` and `subAgent` join rows, but `agent` rows must be deleted explicitly since the FK direction is `subAgent.agentId → agent.id` (not reverse cascade).
- `addStage({ contentTypeId, name, position?, optional? })` — Insert stage, auto-position by querying max position + 1 if omitted
- `updateStage(id, fields)` — Update name, optional
- `deleteStage(id)` — Within a transaction: collect sub-agent `agentId`s for this stage, delete the stage (cascades `subAgent` join rows), explicitly delete collected sub-agent `agent` rows, set `content.currentStageId = null` for any content pieces referencing this stage.
- `reorderStages(contentTypeId, stageIds)` — Within a transaction: validate stageIds match all stages for this content type (return error if mismatch). Set all positions to negative temporaries first (`-1, -2, ...`) to avoid unique constraint violations, then set final positions from array index + 1.
- `bindSubAgent({ stageId, agentId, executionOrder? })` — Insert sub-agent join row
- `unbindSubAgent(id)` — Read the sub-agent join row to get its `agentId`, delete the join row, then delete the `agent` row (since each sub-agent agent copy is specific to one binding — no sharing).

Existing functions remain unchanged: `getContentTypeWithStages`, `getAppContentTypes`, `getContentTypeById`, `getStagesByContentType`, `getSubAgentsByStage`.

## Data Wrappers

`apps/web/lib/data/content-types.ts` — Add re-exports for the new query functions.

## Content Page Integration

After Phase 2, the "New content" dialog should only show **project-scoped** content types (installed ones), not app-scoped templates.

- Content page: change `getAppContentTypes()` → `getContentTypesByProject(projectId)`
- If no content types installed for the project: show empty state message "No content types configured. Visit the Agents tab to install one." instead of the "New content" button.
- No fallback to app-scoped templates — creating content always requires an installed (project-scoped) content type.

## File Structure

```
apps/web/
├── app/
│   ├── api/
│   │   └── content-types/
│   │       ├── route.ts                    # GET (list by projectId)
│   │       ├── install/
│   │       │   └── route.ts                # POST install
│   │       ├── templates/
│   │       │   └── route.ts                # GET templates
│   │       └── [id]/
│   │           ├── route.ts                # GET, PATCH, DELETE
│   │           └── stages/
│   │               ├── route.ts            # POST (add stage)
│   │               ├── reorder/
│   │               │   └── route.ts        # POST reorder
│   │               └── [stageId]/
│   │                   ├── route.ts        # PATCH, DELETE stage
│   │                   └── sub-agents/
│   │                       ├── route.ts    # POST bind
│   │                       └── [subAgentId]/
│   │                           └── route.ts # DELETE unbind
│   └── orgs/[orgId]/projects/[projectId]/
│       └── (project-nav)/
│           └── agents/
│               ├── page.tsx                # Agents list + template gallery
│               └── [contentTypeId]/
│                   └── page.tsx            # Content type detail/edit
├── components/
│   └── agents/
│       ├── template-gallery.tsx            # Template card grid (client)
│       ├── installed-content-types.tsx      # Installed list (client)
│       ├── content-type-detail.tsx          # Detail/edit view (client)
│       ├── stage-list.tsx                  # Stages with reorder (client)
│       └── install-button.tsx              # Install action button (client)
├── lib/
│   ├── api/
│   │   └── with-auth.ts                   # Auth wrapper utility
│   └── data/
│       └── content-types.ts               # Updated re-exports
└── tests/e2e/
    └── agents.spec.ts                     # Phase 2 E2E tests
```

## Testing

### API-level tests (in `agents.spec.ts`)

1. **Install flow** — Install "Blog Post" template → verify project-scoped content type, content agent, 3 stages, 3 sub-agents, agent tool bindings all created with correct `sourceId` references
2. **Content type CRUD** — Update name → verify. Delete (no content) → verify cascade (content type + stages + sub-agent join rows + agent rows all removed). Delete (with content) → verify 409.
3. **Stage CRUD** — Add stage → verify position. Reorder 3 stages → verify new positions respect unique constraint. Delete stage → verify sub-agent join rows and agent rows removed.
4. **Sub-agent binding** — Bind agent to stage → verify join row. Unbind → verify join row and agent row both removed.

### E2E browser tests (in `agents.spec.ts`)

1. **Agents tab navigation** — Navigate to Agents tab → see template gallery (no installed types yet)
2. **Install content type** — Click Install on "Blog Post" → see it appear in installed list with stages
3. **Content type detail** — Click installed type → see stages and sub-agents listed
4. **New content dialog updated** — After installing, "New content" dialog shows installed types
5. **Uninstall** — Delete content type (no content references) → removed from list

### Test structure

Same serial pattern as `content.spec.ts`: setup (sign up, create org, create project), then sequential tests that build on shared state, cleanup in `afterAll`.

## Out of Scope (Deferred)

- Sub-agent prompt editing (Phase 4)
- Content Agent prompt editing (Phase 4)
- Model selection per agent (Phase 4)
- Tool management on sub-agents (Phase 4)
- Creating content types from scratch (Phase 5)
- Forking content types (Phase 5)
- Frontmatter schema visual editor (Phase 5)
- Drag-to-reorder stages (use up/down buttons or batch reorder for Phase 2)
