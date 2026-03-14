import { streamText, simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"

// Cycle through 3 mock responses
const MOCK_RESPONSES = [
  // 1. Content marketing draft
  "Here's a draft for your content marketing piece:\n\n**Engaging Your Audience with Authentic Storytelling**\n\nIn today's crowded digital landscape, brands that stand out are those that tell authentic stories. Rather than focusing solely on product features, the most effective content marketing connects with readers on an emotional level.\n\nStart by identifying your brand's core values and how they align with your audience's aspirations. Then craft narratives that demonstrate these values in action through real customer experiences, behind-the-scenes glimpses, and honest conversations about challenges overcome.\n\nRemember: authenticity builds trust, and trust drives long-term loyalty.",

  // 2. Response with reasoning/thinking
  "I've analyzed your content structure and here's my assessment:\n\n**Strengths:**\n- Clear value proposition in the opening paragraph\n- Good use of subheadings for scannability\n- Strong call-to-action at the end\n\n**Areas for improvement:**\n- The second paragraph could be more concise — readers may lose interest before the key message\n- Consider adding a statistic or data point to support your main claim\n- The tone shifts slightly between sections; aim for consistency throughout\n\n**Recommendation:** Focus on tightening the middle section and ensuring your narrative arc flows naturally from problem to solution to outcome.",

  // 3. Edits made
  "I've made the following edits to improve your content:\n\n1. **Headline** — Revised to be more action-oriented and specific to your target audience\n2. **Opening hook** — Replaced the generic introduction with a compelling question that speaks directly to your reader's pain point\n3. **Body paragraphs** — Trimmed by ~20% to improve pacing while preserving all key messages\n4. **Transitions** — Added smoother connective phrases between sections for better flow\n5. **Closing** — Strengthened the CTA with a clearer next step and sense of urgency\n\nThe overall word count is now 380 words, which is well within the optimal range for blog posts targeting a 2-3 minute read time.",
]

let responseIndex = 0

function getNextMockResponse(): string {
  const response = MOCK_RESPONSES[responseIndex % MOCK_RESPONSES.length]!
  responseIndex++
  return response
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const mockText = getNextMockResponse()

  // Split text into word-sized chunks for realistic streaming
  const words = mockText.split(/(?<=\s)|(?=\s)/)
  const textChunks = words.filter((w) => w.length > 0)

  // Build stream chunks matching LanguageModelV3StreamPart shape
  const chunks = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    ...textChunks.map((chunk) => ({
      type: "text-delta",
      id: "1",
      delta: chunk,
    })),
    { type: "text-end", id: "1" },
    {
      type: "finish",
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: textChunks.length,
          text: textChunks.length,
          reasoning: undefined,
        },
      },
      finishReason: { unified: "stop", raw: "stop" },
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks,
        chunkDelayInMs: 50,
      }),
    }),
  } as any)

  const result = streamText({
    model,
    prompt: "mock",
  })

  return result.toUIMessageStreamResponse()
}
