// apps/web/lib/ai/test-connection.ts
import type { ProviderType } from "@workspace/db"

export type TestResult = { success: true } | { success: false; error: string }

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  groq: "https://api.groq.com/openai",
  "ai-gateway": "https://ai-gateway.vercel.sh",
}

const TEST_TIMEOUT_MS = 5_000

export async function testProviderConnection(params: {
  providerType: ProviderType
  apiKey: string
  baseURL?: string
}): Promise<TestResult> {
  const { providerType, apiKey, baseURL } = params

  const base = baseURL?.replace(/\/+$/, "") || PROVIDER_BASE_URLS[providerType]
  if (!base) {
    return { success: false, error: "Unknown provider type" }
  }

  const url = `${base}/v1/models`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    })

    if (res.ok) {
      return { success: true }
    }

    const errorMessage = await extractErrorMessage(res)
    return { success: false, error: errorMessage }
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { success: false, error: "Connection timed out" }
    }
    if (err instanceof TypeError) {
      return {
        success: false,
        error: "Could not reach provider — check the base URL",
      }
    }
    return { success: false, error: "Connection failed" }
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const providerMessage =
      body?.error?.message ?? body?.error?.type ?? body?.message
    if (typeof providerMessage === "string" && providerMessage.length > 0) {
      return providerMessage
    }
  } catch {
    // Body wasn't JSON, fall through to status-based mapping
  }

  switch (res.status) {
    case 401:
      return "Invalid API key"
    case 403:
      return "Access denied — check API key permissions"
    case 429:
      return "Rate limited — try again in a moment"
    default:
      return `Unexpected error (${res.status})`
  }
}
