import type { Message, StreamEvent } from "../../shared/protocol"
import { model, openai, toOpenAIInput } from "./openai"
import { systemPrompt } from "./system-prompt"

/**
 * Calls OpenAI and yields our own StreamEvents. This is the only place that
 * knows OpenAI's event names; swapping providers means rewriting this file.
 */
export async function* streamChat(
  messages: Message[],
  signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  try {
    const stream = await openai.responses.create(
      {
        model,
        instructions: systemPrompt,
        input: toOpenAIInput(messages),
        stream: true,
        store: false, // stateless: the client sends the full history each time
      },
      { signal }
    )

    for await (const event of stream) {
      switch (event.type) {
        case "response.output_text.delta":
        case "response.refusal.delta":
          yield { type: "text-delta", delta: event.delta }
          break

        case "response.failed":
          yield {
            type: "error",
            message: event.response.error?.message ?? "The model failed to respond.",
          }
          return

        case "response.incomplete":
          yield {
            type: "error",
            message: `Response cut off (${event.response.incomplete_details?.reason ?? "unknown reason"}).`,
          }
          return

        case "error":
          yield { type: "error", message: event.message }
          return

        // Everything else (created, in_progress, reasoning, item added/done…)
        // isn't needed yet. Step 2 starts listening for function calls here.
      }
    }

    yield { type: "done" }
  } catch (err) {
    if (signal.aborted) return // the client hit Stop; nobody is listening
    console.error(err)
    yield { type: "error", message: err instanceof Error ? err.message : "Unknown error" }
  }
}
