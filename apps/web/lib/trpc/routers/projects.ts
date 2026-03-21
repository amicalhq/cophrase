import { z } from "zod"
import { orgProcedure, router } from "@/lib/trpc/init"
import { getProjectsByOrg, createProject } from "@/lib/data/projects"

export const projectsRouter = router({
  list: orgProcedure.query(async ({ input }) => {
    return getProjectsByOrg(input.orgId)
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1, "Name is required")
          .max(255, "Name must be 255 characters or less")
          .transform((s) => s.trim()),
        description: z
          .string()
          .max(2000, "Description must be 2000 characters or less")
          .optional()
          .transform((s) => s?.trim() || undefined),
      })
    )
    .mutation(async ({ input }) => {
      return createProject({
        name: input.name,
        description: input.description,
        organizationId: input.orgId,
      })
    }),
})
