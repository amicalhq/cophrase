import { drizzle } from "drizzle-orm/postgres-js"
import { inArray, eq } from "drizzle-orm"
import postgres from "postgres"
import { content } from "./schema/index"
import { user, organization, member, account } from "./schema/auth"
import { project } from "./schema/projects"

process.loadEnvFile("../../.env.local")

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

const SEED_IDS = {
  content: [
    "ct_seed00001",
    "ct_seed00002",
    "ct_seed00003",
    "ct_seed00004",
    "ct_seed00005",
  ],
  project: "seed_proj_001",
  member: "seed_member_01",
  account: "seed_account_01",
  org: "seed_org_00001",
  user: "seed_user_0001",
}

async function unseed() {
  // Delete in reverse dependency order

  console.log("Removing seed content...")
  const contentResult = await db
    .delete(content)
    .where(inArray(content.id, SEED_IDS.content))
    .returning({ id: content.id })
  console.log(`Removed ${contentResult.length} seed content pieces.`)

  console.log("Removing seed project...")
  await db.delete(project).where(eq(project.id, SEED_IDS.project))

  console.log("Removing seed member...")
  await db.delete(member).where(eq(member.id, SEED_IDS.member))

  console.log("Removing seed account...")
  await db.delete(account).where(eq(account.id, SEED_IDS.account))

  console.log("Removing seed organization...")
  await db.delete(organization).where(eq(organization.id, SEED_IDS.org))

  console.log("Removing seed user...")
  await db.delete(user).where(eq(user.id, SEED_IDS.user))

  console.log("Unseed complete.")
  await client.end()
}

unseed().catch((err) => {
  console.error("Unseed failed:", err)
  process.exit(1)
})
