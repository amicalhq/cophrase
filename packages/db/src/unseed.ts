import { drizzle } from "drizzle-orm/postgres-js"
import { inArray, eq } from "drizzle-orm"
import postgres from "postgres"
import { content } from "./schema/index"
import { user, organization, member, account } from "./schema/auth"
import { project } from "./schema/projects"
import { agent, agentTool } from "./schema/agents"
import { contentType, contentTypeStage, subAgent } from "./schema/content-types"

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
  subAgents: [
    "seed_sa_blog_1",
    "seed_sa_blog_2",
    "seed_sa_blog_3",
    "seed_sa_x_1",
    "seed_sa_x_2",
    "seed_sa_li_1",
    "seed_sa_li_2",
    "seed_sa_li_3",
    "seed_sa_cl_1",
    "seed_sa_cl_2",
    "seed_sa_cl_3",
    "seed_sa_nl_1",
    "seed_sa_nl_2",
    "seed_sa_nl_3",
  ],
  stages: [
    "seed_cts_blog_1",
    "seed_cts_blog_2",
    "seed_cts_blog_3",
    "seed_cts_x_1",
    "seed_cts_x_2",
    "seed_cts_li_1",
    "seed_cts_li_2",
    "seed_cts_li_3",
    "seed_cts_cl_1",
    "seed_cts_cl_2",
    "seed_cts_cl_3",
    "seed_cts_nl_1",
    "seed_cts_nl_2",
    "seed_cts_nl_3",
  ],
  contentTypes: [
    "seed_cty_blog",
    "seed_cty_x",
    "seed_cty_li",
    "seed_cty_cl",
    "seed_cty_nl",
  ],
  agentTools: [
    "seed_ats_blog_re",
    "seed_ats_x_re",
    "seed_ats_li_re",
    "seed_ats_nl_re",
  ],
  agents: [
    "seed_agt_blog_ca",
    "seed_agt_blog_re",
    "seed_agt_blog_dr",
    "seed_agt_blog_hu",
    "seed_agt_x_ca",
    "seed_agt_x_re",
    "seed_agt_x_wr",
    "seed_agt_li_ca",
    "seed_agt_li_re",
    "seed_agt_li_wr",
    "seed_agt_li_rf",
    "seed_agt_cl_ca",
    "seed_agt_cl_co",
    "seed_agt_cl_su",
    "seed_agt_cl_fm",
    "seed_agt_nl_ca",
    "seed_agt_nl_re",
    "seed_agt_nl_dr",
    "seed_agt_nl_rf",
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

  console.log("Removing seed sub-agents...")
  await db.delete(subAgent).where(inArray(subAgent.id, SEED_IDS.subAgents))

  console.log("Removing seed stages...")
  await db
    .delete(contentTypeStage)
    .where(inArray(contentTypeStage.id, SEED_IDS.stages))

  console.log("Removing seed content types...")
  await db.delete(contentType).where(inArray(contentType.id, SEED_IDS.contentTypes))

  console.log("Removing seed agent tools...")
  await db.delete(agentTool).where(inArray(agentTool.id, SEED_IDS.agentTools))

  console.log("Removing seed agents...")
  await db.delete(agent).where(inArray(agent.id, SEED_IDS.agents))

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
