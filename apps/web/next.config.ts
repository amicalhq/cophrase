import { withWorkflow } from "workflow/next"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/db",
    "@workspace/auth",
    "@workspace/workflows",
  ],
}

export default withWorkflow(nextConfig)
