import { NextResponse } from "next/server"
import { withSessionAuth } from "@/lib/api/with-auth"
import {
  getAppContentTypes,
  getStagesByContentType,
} from "@/lib/data/content-types"

export const GET = withSessionAuth(async (_req, { session: _session }) => {
  const templates = await getAppContentTypes()
  const templatesWithStages = await Promise.all(
    templates.map(async (t) => {
      const stages = await getStagesByContentType(t.id)
      return {
        ...t,
        stages: stages.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        })),
      }
    }),
  )
  return NextResponse.json(templatesWithStages)
})
