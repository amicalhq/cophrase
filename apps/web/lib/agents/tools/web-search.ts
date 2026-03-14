import { z } from "zod"
import { tool } from "ai"

interface ExaSearchResult {
  title: string
  url: string
  text?: string
  publishedDate?: string
  author?: string
}

interface ExaSearchResponse {
  results: ExaSearchResult[]
}

/**
 * AI SDK tool that searches the web using the Exa API.
 * Requires the EXA_API_KEY environment variable.
 */
export const webSearchTool = tool({
  description:
    "Search the web for information on a topic. Returns relevant web pages " +
    "with titles, URLs, and text snippets. Use this for research and fact-checking.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    numResults: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return (1-10, default 5)"),
  }),
  execute: async ({ query, numResults = 5 }) => {
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
        query,
        numResults,
        type: "auto",
        contents: {
          text: { maxCharacters: 2000 },
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `Exa API error (${response.status}): ${text}` }
    }

    const data = (await response.json()) as ExaSearchResponse

    return {
      results: data.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.text?.slice(0, 500),
        publishedDate: r.publishedDate,
        author: r.author,
      })),
    }
  },
})
