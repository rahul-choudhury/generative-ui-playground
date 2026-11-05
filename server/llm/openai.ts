import OpenAI from "openai"
import type { FunctionTool, ResponseInputItem } from "openai/resources/responses/responses"
import { z } from "zod"
import type { Message } from "../../shared/protocol"
import { checklist } from "../../widgets/checklist/definition"

export const openai = new OpenAI() // reads OPENAI_API_KEY from the environment

export const model = process.env.OPENAI_MODEL ?? "gpt-6-luna"

/**
 * Widgets → OpenAI function tools. Hand-wired for one widget; step 3 turns
 * this into a loop over the registry.
 *
 * strict: true makes OpenAI guarantee the arguments match the schema's shape
 * (every field present, no extras). Zod's JSON Schema output already uses
 * required + additionalProperties: false, which strict mode needs.
 */
export const tools: FunctionTool[] = [
  {
    type: "function",
    name: checklist.name,
    description: checklist.description,
    parameters: z.toJSONSchema(checklist.schema),
    strict: true,
  },
]

/** Our message shape → Responses API input items. */
export function toOpenAIInput(messages: Message[]): ResponseInputItem[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(""),
  }))
}
