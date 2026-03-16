import { customAlphabet } from "nanoid/non-secure"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

function createIdGenerator(prefix: string, size: number) {
  const generate = customAlphabet(alphabet, size)
  return () => `${prefix}_${generate()}`
}

// --- Resource ID generators ---
// Add a new generator here for every new table/resource.
// Use shorter sizes (8) for low-cardinality, longer (16) for high-cardinality.

export const createAiProviderId = createIdGenerator("aip", 10)
export const createAiModelId = createIdGenerator("aim", 10)
export const createUserId = createIdGenerator("usr", 10)
export const createSessionId = createIdGenerator("ses", 16)
export const createAccountId = createIdGenerator("acc", 10)
export const createVerificationId = createIdGenerator("ver", 16)
export const createOrganizationId = createIdGenerator("org", 10)
export const createMemberId = createIdGenerator("mem", 10)
export const createInvitationId = createIdGenerator("inv", 10)
export const createMcpCatalogId = createIdGenerator("mcs", 10)
export const createProjectId = createIdGenerator("prj", 10)
export const createContentId = createIdGenerator("ct", 10)
export const createResourceId = createIdGenerator("res", 10)
export const createResourceContentId = createIdGenerator("rsc", 10)
export const createAgentId = createIdGenerator("agt", 10)
export const createArtifactId = createIdGenerator("atf", 16)
export const createAgentRunId = createIdGenerator("run", 16)
export const createAgentMessageId = createIdGenerator("msg", 16)
export const createMcpConnectionId = createIdGenerator("mcc", 10)
export const createAgentToolId = createIdGenerator("ats", 10)
export const createHarnessMessageId = createIdGenerator("hm", 16)
