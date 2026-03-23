import { pathToFileURL } from "node:url"
import { seedAppTemplates } from "./seed"
import { createSeedDb } from "./seed-db"

export async function seedApp() {
  const { client, db } = createSeedDb({
    envFiles: [process.env.SEED_ENV_FILE, "../../.env", "../../.env.local"],
  })

  try {
    await seedAppTemplates(db)
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedApp().catch((err) => {
    console.error("App seed failed:", err)
    process.exit(1)
  })
}
