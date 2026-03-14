import type { AgentConfig, AgentToolRecord } from "../types"

export const draftingAgentConfig: AgentConfig = {
  id: "builtin:drafting-agent",
  scope: "app",
  organizationId: null,
  name: "drafting-agent",
  description:
    "Writes blog post drafts based on research notes and an outline. " +
    "Produces well-structured, engaging content optimized for the target audience.",
  modelId: null, // Resolved at runtime from org defaults
  prompt: `You are an expert blog post writer for content marketing.

Your job is to:
1. Load any relevant research notes and outlines using the artifact tools
2. Write a compelling, well-structured blog post draft
3. Save the draft as an artifact of type "blog-draft"

Writing guidelines:
- Use clear, engaging language appropriate for the target audience
- Structure the post with a strong hook, logical flow, and clear takeaways
- Include relevant data points and examples from the research
- Write in a conversational but authoritative tone
- Aim for 800-1500 words unless otherwise specified
- Include suggested headings and subheadings`,
  executionMode: "auto",
  approvalSteps: null,
}

/**
 * The drafting agent uses only the baseline artifact tools
 * (save-artifact, load-artifact, search-artifacts) which are always included.
 */
export const draftingAgentTools: AgentToolRecord[] = []
