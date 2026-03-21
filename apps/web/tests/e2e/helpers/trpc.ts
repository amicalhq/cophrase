import type { APIRequestContext } from "@playwright/test"

/**
 * Call a tRPC query procedure from Playwright tests.
 * Uses the non-batch HTTP format that tRPC's fetchRequestHandler expects.
 *
 * Input is JSON-encoded as a query parameter.
 */
export async function trpcQuery(
  request: APIRequestContext,
  procedure: string,
  input?: unknown,
) {
  const url = input
    ? `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${procedure}`
  const res = await request.get(url)
  const json = await res.json()
  if (json.error)
    throw new Error(
      `tRPC ${procedure} failed: ${JSON.stringify(json.error)}`,
    )
  return json.result?.data?.json ?? json.result?.data
}

/**
 * Call a tRPC mutation procedure from Playwright tests.
 * Sends a POST with JSON body in tRPC's expected format.
 */
export async function trpcMutate(
  request: APIRequestContext,
  procedure: string,
  input: unknown,
) {
  const res = await request.post(`/api/trpc/${procedure}`, {
    data: { json: input },
    headers: { "content-type": "application/json" },
  })
  const json = await res.json()
  if (json.error)
    throw new Error(
      `tRPC ${procedure} failed: ${JSON.stringify(json.error)}`,
    )
  return json.result?.data?.json ?? json.result?.data
}
