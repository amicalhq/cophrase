import { createWorld as createPostgresWorld } from "@workflow/world-postgres"
import { getWorld, setWorld } from "workflow/runtime"

const POSTGRES_WORLD_TARGET = "@workflow/world-postgres"
const WORLD_CACHE_SYMBOL = Symbol.for("@workflow/world//cache")
const WORLD_STUBBED_CACHE_SYMBOL = Symbol.for("@workflow/world//stubbedCache")

function seedPostgresWorld() {
  const world = createPostgresWorld()
  const worldGlobals = globalThis as typeof globalThis & Record<symbol, unknown>

  // Workflow runtime uses two global caches: one for getWorld() and one for
  // lazily created queue handlers. Seed both so standalone never falls back to
  // a runtime require("@workflow/world-postgres"), which is not traceable.
  worldGlobals[WORLD_CACHE_SYMBOL] = world
  worldGlobals[WORLD_STUBBED_CACHE_SYMBOL] = world
  setWorld(world)
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    // Statically seed the Postgres world in production so Next traces it into
    // the standalone bundle, while leaving dev on the default WDK path.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.WORKFLOW_TARGET_WORLD === POSTGRES_WORLD_TARGET
    ) {
      seedPostgresWorld()
    }

    await getWorld().start?.()
  }
}
