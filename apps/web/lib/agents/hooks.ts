import { defineHook } from "workflow"
import type { ModelMessage } from "ai"

/**
 * Hook for receiving new chat messages from the user during a multi-turn conversation.
 * The workflow suspends until a message is sent via `chatMessageHook.resume(token, messages)`.
 */
export const chatMessageHook = defineHook<ModelMessage[]>()

/**
 * Hook for receiving approval/rejection decisions from the user.
 * Used when an agent's execution mode requires human approval for certain steps.
 */
export const approvalHook = defineHook<{
  approved: boolean
  comment?: string
}>()
