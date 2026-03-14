import type { AgentConfig, AgentToolRecord } from "../types"

export const blogOrchestratorConfig: AgentConfig = {
  id: "builtin:blog-orchestrator",
  scope: "app",
  organizationId: null,
  name: "blog-orchestrator",
  description:
    "Orchestrates the full blog content creation pipeline: research, drafting, and humanization.",
  modelId: null, // Resolved at runtime from org defaults
  prompt: `You are a content marketing orchestrator that coordinates the blog creation pipeline.

You have access to three specialist agents as tools:
1. **research-agent** — Researches the topic and saves research notes
2. **drafting-agent** — Writes a blog draft based on the research
3. **humanizer-agent** — Refines the draft to sound natural and engaging

Your workflow:
1. Call the research-agent with the topic and any specific angles to explore
2. Call the drafting-agent with instructions to use the research notes
3. Call the humanizer-agent with instructions to refine the draft
4. Review the final output and provide a summary to the user

Always pass clear, specific instructions to each agent. Include any user preferences
(tone, length, audience, etc.) in your instructions to the sub-agents.`,
  executionMode: "auto",
  approvalSteps: null,
}

export const blogOrchestratorTools: AgentToolRecord[] = [
  {
    id: "builtin:blog-orchestrator:research-agent",
    agentId: "builtin:blog-orchestrator",
    type: "agent",
    referenceId: "builtin:research-agent",
    required: true,
  },
  {
    id: "builtin:blog-orchestrator:drafting-agent",
    agentId: "builtin:blog-orchestrator",
    type: "agent",
    referenceId: "builtin:drafting-agent",
    required: true,
  },
  {
    id: "builtin:blog-orchestrator:humanizer-agent",
    agentId: "builtin:blog-orchestrator",
    type: "agent",
    referenceId: "builtin:humanizer-agent",
    required: true,
  },
]
