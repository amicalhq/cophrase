import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"
import { db } from "@workspace/db"
import {
  createUserId,
  createSessionId,
  createAccountId,
  createVerificationId,
  createOrganizationId,
  createMemberId,
  createInvitationId,
} from "@workspace/id"

const idGenerators: Record<string, () => string> = {
  user: createUserId,
  session: createSessionId,
  account: createAccountId,
  verification: createVerificationId,
  organization: createOrganizationId,
  member: createMemberId,
  invitation: createInvitationId,
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
    }),
    nextCookies(),
  ],
  advanced: {
    database: {
      generateId: ({ model }: { model: string }) => {
        const generator = idGenerators[model]
        if (generator) return generator()
        return createUserId() // fallback
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
