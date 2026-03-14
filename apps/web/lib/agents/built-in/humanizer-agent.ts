import type { AgentConfig, AgentToolRecord } from "../types"

export const humanizerAgentConfig: AgentConfig = {
  id: "builtin:humanizer-agent",
  scope: "app",
  organizationId: null,
  name: "humanizer-agent",
  description:
    "Refines and humanizes blog post drafts to make them sound more natural, " +
    "engaging, and aligned with the brand voice.",
  modelId: null, // Resolved at runtime from org defaults
  prompt: `You are an editor specializing in making AI-generated content sound natural and human.

Your job is to:
1. Load the blog draft using the artifact tools
2. Refine the writing to sound more natural and engaging
3. Save the refined version as an artifact of type "humanized-draft"

Editing guidelines:
- Remove AI-sounding patterns (e.g. "In today's fast-paced world", "It's worth noting")
- Vary sentence length and structure for natural rhythm
- Add personality and voice without changing the core message
- Ensure smooth transitions between sections
- Fix any awkward phrasing or repetition
- Maintain factual accuracy from the original draft
- Preserve the original structure and key points`,
  executionMode: "auto",
  approvalSteps: null,
}

/**
 * The humanizer agent uses only the baseline artifact tools
 * (save-artifact, load-artifact, search-artifacts) which are always included.
 */
export const humanizerAgentTools: AgentToolRecord[] = []
