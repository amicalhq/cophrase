export type PromptSuggestion = {
  label: string
  prompt: string
  primary?: boolean
}

export interface StageInfo {
  id: string
  name: string
  position: number
}

/**
 * Generate initial suggestions from stage data.
 * Called when a conversation has no messages yet.
 */
export function generateInitialSuggestions(
  stages: StageInfo[],
  currentStageId: string | null,
): PromptSuggestion[] {
  if (stages.length === 0) return []

  // Find the current or first stage
  const currentStage = currentStageId
    ? stages.find((s) => s.id === currentStageId)
    : stages[0]

  if (!currentStage) return []

  const suggestions: PromptSuggestion[] = [
    {
      label: `Start ${currentStage.name}`,
      prompt: `Run the ${currentStage.name} stage to begin working on this content`,
      primary: true,
    },
    {
      label: "Add more context",
      prompt: "Before we start, let me give you more context about what I want",
    },
  ]

  return suggestions
}
