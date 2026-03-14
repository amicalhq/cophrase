import type { AgentConfig, AgentToolRecord } from "../types"

export const researchAgentConfig: AgentConfig = {
  id: "builtin:research-agent",
  scope: "app",
  organizationId: null,
  name: "research-agent",
  description:
    "Researches a given topic by searching the web and synthesizing findings into structured research notes.",
  modelId: null, // Resolved at runtime from org defaults
  prompt: `You are a research assistant specializing in content marketing research.

Your job is to:
1. Search the web for relevant, recent information on the given topic
2. Identify key themes, statistics, quotes, and expert opinions
3. Synthesize your findings into structured research notes
4. Save your research as an artifact of type "research-notes"

Always cite your sources with URLs. Focus on finding diverse perspectives and actionable insights.
Be thorough but concise — aim for quality over quantity.`,
  executionMode: "auto",
  approvalSteps: null,
}

export const researchAgentTools: AgentToolRecord[] = [
  {
    id: "builtin:research-agent:web-search",
    agentId: "builtin:research-agent",
    type: "function",
    referenceId: "web-search",
    required: true,
  },
]
