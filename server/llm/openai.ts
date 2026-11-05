import OpenAI from "openai"
import type { ResponseInputItem } from "openai/resources/responses/responses"
import type { Message } from "../../shared/protocol"

export const openai = new OpenAI() // reads OPENAI_API_KEY from the environment

export const model = process.env.OPENAI_MODEL ?? "gpt-6-luna"

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
