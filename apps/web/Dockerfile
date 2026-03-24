FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate

FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/id/package.json ./packages/id/package.json
COPY packages/workflows/package.json ./packages/workflows/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# apps/web/.env* are typically symlinks back to the repo root in local dev.
RUN rm -f apps/web/.env apps/web/.env.local \
  && touch apps/web/.env apps/web/.env.local

RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
  BETTER_AUTH_SECRET=placeholder-secret-that-is-long-enough-for-build \
  BETTER_AUTH_URL=http://localhost:3000 \
  WORKFLOW_TARGET_WORLD=@workflow/world-postgres \
  WORKFLOW_POSTGRES_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
  pnpm --filter web build

RUN node <<'NODE'
const fs = require("node:fs/promises")
const path = require("node:path")

const root = process.cwd()
const pnpmDir = path.join(root, "node_modules/.pnpm")
const packageSymlink = path.join(
  root,
  "apps/web/node_modules/@workflow/world-postgres"
)
const outRoot = path.join(root, ".workflow-runtime")
const outPnpmDir = path.join(outRoot, "node_modules/.pnpm")
const outPackageSymlink = path.join(
  outRoot,
  "apps/web/node_modules/@workflow/world-postgres"
)

const copiedPackages = new Set()

async function copyPackageDir(packageDirName) {
  if (copiedPackages.has(packageDirName)) {
    return
  }

  copiedPackages.add(packageDirName)

  const sourceDir = path.join(pnpmDir, packageDirName)
  const destinationDir = path.join(outPnpmDir, packageDirName)

  await fs.mkdir(path.dirname(destinationDir), { recursive: true })
  await fs.cp(sourceDir, destinationDir, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  })

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isSymbolicLink()) {
        const linkTarget = await fs.readlink(fullPath)
        const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget)

        if (resolvedTarget.startsWith(`${pnpmDir}${path.sep}`)) {
          const relativeTarget = path.relative(pnpmDir, resolvedTarget)
          const [linkedPackageDir] = relativeTarget.split(path.sep)

          if (linkedPackageDir && linkedPackageDir !== "node_modules") {
            await copyPackageDir(linkedPackageDir)
          }
        }

        continue
      }

      if (entry.isDirectory()) {
        await walk(fullPath)
      }
    }
  }

  await walk(sourceDir)
}

async function main() {
  await fs.rm(outRoot, { recursive: true, force: true })

  const linkTarget = await fs.readlink(packageSymlink)
  const resolvedTarget = path.resolve(path.dirname(packageSymlink), linkTarget)
  const relativeTarget = path.relative(pnpmDir, resolvedTarget)
  const [packageDirName] = relativeTarget.split(path.sep)

  if (!packageDirName) {
    throw new Error("Could not resolve pnpm package dir for @workflow/world-postgres")
  }

  await copyPackageDir(packageDirName)
  await fs.mkdir(path.dirname(outPackageSymlink), { recursive: true })
  await fs.cp(packageSymlink, outPackageSymlink, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
NODE

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BETTER_AUTH_INTERNAL_URL=http://127.0.0.1:3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/.workflow-runtime/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/.workflow-runtime/apps/web/node_modules/@workflow ./apps/web/node_modules/@workflow

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000

CMD ["node", "server.js"]
