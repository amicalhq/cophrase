/**
 * Step functions for agent workflows.
 *
 * All functions here use "use step" and can access Node.js modules (DB, crypto, etc.).
 * The workflow file (run-agent.ts) imports ONLY from this file, workflow, @workflow/ai,
 * and ai — never from @workspace/db or other Node.js-dependent modules directly.
 */

import type { ModelMessage } from "ai"
import { resolveModel } from "./resolve-model"
import { getAgentTools } from "@workspace/db/queries/agents"
import {
  saveMessages,
  getExistingMessageIds,
} from "@workspace/db/queries/agent-runs"
import {
  createArtifact,
  getArtifactById,
  getNextArtifactVersion,
  searchArtifacts as searchArtifactsQuery,
} from "@workspace/db/queries/artifacts"
import { updateContentStage } from "@workspace/db/queries/content"
import type { ArtifactStatus } from "@workspace/db"
import type { AgentToolRecord, RunContext } from "./types"

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

export async function resolveModelStep(
  modelId: string | null,
  organizationId: string,
) {
  "use step"
  return resolveModel(modelId, organizationId)
}

// ---------------------------------------------------------------------------
// Tool record loading
// ---------------------------------------------------------------------------

export async function loadToolRecords(
  agentId: string,
): Promise<AgentToolRecord[]> {
  "use step"
  return (await getAgentTools(agentId)) as AgentToolRecord[]
}

// ---------------------------------------------------------------------------
// Message persistence
// ---------------------------------------------------------------------------

export async function persistNewMessages(
  runId: string,
  messages: ModelMessage[],
) {
  "use step"
  const existingIds = await getExistingMessageIds(runId)
  const newMessages = messages.filter(
    (m) => "id" in m && typeof m.id === "string" && !existingIds.has(m.id),
  )

  if (newMessages.length === 0) return

  await saveMessages(
    runId,
    newMessages.map((m) => ({
      id: (m as ModelMessage & { id: string }).id,
      role: m.role as "user" | "assistant" | "system" | "tool",
      parts: "content" in m ? m.content : null,
      metadata: undefined,
    })),
  )
}

// ---------------------------------------------------------------------------
// Artifact operations (used as tool execute functions)
// ---------------------------------------------------------------------------

export async function saveArtifactStep(input: {
  ctx: RunContext
  type: string
  title: string
  data: unknown
  parentIds?: string[]
}) {
  "use step"
  const { ctx, type, title, data, parentIds } = input

  const version = ctx.contentId
    ? await getNextArtifactVersion(ctx.contentId, type)
    : 1

  const artifact = await createArtifact({
    organizationId: ctx.organizationId,
    projectId: ctx.projectId,
    contentId: ctx.contentId || undefined,
    agentId: ctx.agentId,
    runId: ctx.runId,
    type,
    title,
    data,
    version,
    parentIds,
  })

  // Advance content stage when a blog draft is saved
  if (type === "blog-draft" && ctx.contentId) {
    await updateContentStage(ctx.contentId, "draft")
  }

  return {
    artifactId: artifact.id,
    type: artifact.type,
    title: artifact.title,
    version: artifact.version,
  }
}

export async function loadArtifactStep(artifactId: string) {
  "use step"
  const artifact = await getArtifactById(artifactId)
  if (!artifact) {
    return { error: `Artifact not found: ${artifactId}` }
  }
  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    data: artifact.data,
    version: artifact.version,
    status: artifact.status,
    createdAt: artifact.createdAt.toISOString(),
  }
}

export async function searchArtifactsStep(input: {
  organizationId: string
  contentId?: string
  runId?: string
  type?: string
  status?: ArtifactStatus
}) {
  "use step"
  const results = await searchArtifactsQuery(input)
  return {
    count: results.length,
    artifacts: results.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      version: a.version,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function webSearchStep(input: {
  query: string
  numResults?: number
}) {
  "use step"
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    return { error: "EXA_API_KEY is not configured" }
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: input.query,
      numResults: input.numResults ?? 5,
      type: "auto",
      contents: { text: { maxCharacters: 2000 } },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { error: `Exa API error (${response.status}): ${text}` }
  }

  const data = await response.json()
  return {
    results: (data.results ?? []).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.slice(0, 500),
    })),
  }
}
