import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { jwt, organization } from "better-auth/plugins"
import { oauthProvider } from "@better-auth/oauth-provider"
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

function getTrustedOrigins() {
  const runtimeOrigin = process.env.BETTER_AUTH_URL?.trim()

  return Array.from(
    new Set(
      [runtimeOrigin, "http://localhost:3000", "http://127.0.0.1:3000"].filter(
        (origin): origin is string => Boolean(origin)
      )
    )
  )
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: getTrustedOrigins(),
  rateLimit: process.env.DISABLE_RATE_LIMIT === "true"
    ? { enabled: false }
    : undefined,
  emailAndPassword: {
    enabled: true,
  },
  disabledPaths: ["/token"],
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
    }),
    jwt(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: ["cophrase"],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      validAudiences: [`${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/mcp`],
      accessTokenExpiresIn: 3600,
      refreshTokenExpiresIn: 2592000,
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

export { toNextJsHandler } from "better-auth/next-js"
