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

/**
 * Our message shape → Responses API input items, keeping part order.
 *
 * A widget part becomes a function_call plus its function_call_output: the
 * API rejects a call without a matching output. We send only call_id (never
 * OpenAI's item ids) because with store: false those items don't exist
 * server-side.
 */
export function toOpenAIInput(messages: Message[]): ResponseInputItem[] {
  const items: ResponseInputItem[] = []

  for (const message of messages) {
    let text = ""
    const flushText = () => {
      if (text) items.push({ role: message.role, content: text })
      text = ""
    }

    for (const part of message.parts) {
      if (part.type === "text") {
        text += part.text
        continue
      }
      // A widget interrupted mid-stream (Stop) never got arguments; drop it.
      if (part.args === undefined) continue

      flushText()
      items.push({
        type: "function_call",
        call_id: part.id,
        name: part.name,
        arguments: JSON.stringify(part.args),
      })
      items.push({
        type: "function_call_output",
        call_id: part.id,
        // Step 6 replaces this with the widget's live state (e.g. ticked items).
        output: "Shown to the user.",
      })
    }
    flushText()
  }

  return items
}
