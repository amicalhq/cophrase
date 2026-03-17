import type { ContentType, ContentStage } from "@workspace/db"

export type PromptSuggestion = {
  label: string
  prompt: string
  primary?: boolean
}

const INITIAL_SUGGESTIONS: Record<
  ContentType,
  Partial<Record<ContentStage, PromptSuggestion[]>>
> = {
  blog: {
    idea: [
      {
        label: "Start researching",
        prompt: "Research this topic and find relevant sources",
        primary: true,
      },
      {
        label: "Add more context",
        prompt:
          "Before we start, let me give you more context about what I want",
      },
    ],
    draft: [
      {
        label: "Start drafting",
        prompt: "Write a draft based on the research notes",
        primary: true,
      },
      {
        label: "Review research first",
        prompt: "Show me a summary of the research so far",
      },
    ],
    review: [
      {
        label: "Humanize the draft",
        prompt: "Refine the draft to sound more natural and human",
        primary: true,
      },
      {
        label: "View current draft",
        prompt: "Show me the current draft",
      },
    ],
  },
  social: {
    idea: [
      {
        label: "Start researching",
        prompt: "Research this topic for a social post",
        primary: true,
      },
      {
        label: "Add more context",
        prompt: "Before we start, let me give you more context",
      },
    ],
  },
}

export function getInitialSuggestions(
  contentType: ContentType,
  stage: ContentStage,
): PromptSuggestion[] {
  return INITIAL_SUGGESTIONS[contentType]?.[stage] ?? []
}
