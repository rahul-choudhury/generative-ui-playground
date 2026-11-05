import type { ResponseStreamEvent } from "openai/resources/responses/responses"
import type { Message, StreamEvent } from "../../shared/protocol"
import { toUsage } from "./models"
import { model, openai, toOpenAIInput } from "./openai"
import { tools } from "./tools"
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
        tools,
        stream: true,
        store: false, // stateless: the client sends the full history each time
      },
      { signal }
    )

    // Argument deltas carry OpenAI's item_id, not the call_id we use as the
    // widget id, so remember the mapping from output_item.added.
    const callIdByItemId = new Map<string, string>()

    for await (const event of stream) {
      if (LOG_EVENTS) logEvent(event)

      switch (event.type) {
        case "response.output_text.delta":
        case "response.refusal.delta":
          yield { type: "text-delta", delta: event.delta }
          break

        // Function calls. A reasoning item may come first, so these are
        // tracked by id, never by output_index.
        case "response.output_item.added":
          if (event.item.type === "function_call") {
            if (event.item.id) callIdByItemId.set(event.item.id, event.item.call_id)
            yield { type: "tool-call-start", id: event.item.call_id, name: event.item.name }
          }
          break

        case "response.function_call_arguments.delta": {
          const id = callIdByItemId.get(event.item_id)
          if (id) yield { type: "tool-call-delta", id, delta: event.delta }
          break
        }

        case "response.output_item.done":
          if (event.item.type === "function_call") {
            yield { type: "tool-call-end", id: event.item.call_id, args: parseArgs(event.item.arguments) }
          }
          break

        // Usage only arrives in these final events. A reply cut off by Stop
        // never gets one, so its cost stays unknown.
        case "response.completed": {
          const usage = toUsage(event.response)
          if (usage) yield { type: "usage", usage }
          break
        }

        case "response.failed": {
          const usage = toUsage(event.response)
          if (usage) yield { type: "usage", usage } // partial work is still billed
          yield {
            type: "error",
            message: event.response.error?.message ?? "The model failed to respond.",
          }
          return
        }

        case "response.incomplete": {
          const usage = toUsage(event.response)
          if (usage) yield { type: "usage", usage }
          yield {
            type: "error",
            message: `Response cut off (${event.response.incomplete_details?.reason ?? "unknown reason"}).`,
          }
          return
        }

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

/**
 * Strict mode guarantees valid JSON in practice. If it ever isn't, pass null
 * and let the client's schema check reject it rather than crash the stream.
 */
function parseArgs(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    console.error("[llm] unparseable tool arguments:", json)
    return null
  }
}

// ─── Debug logging ──────────────────────────────────────────────────────────
// LOG_LLM_EVENTS=1 prints every raw OpenAI event, one per line. Events that
// carry the whole response object are summarised so the log stays readable.

const LOG_EVENTS = process.env.LOG_LLM_EVENTS === "1"

function logEvent(event: ResponseStreamEvent) {
  const { sequence_number, ...rest } = event
  if ("response" in event) {
    const output = event.response.output.map((o) => ("name" in o ? `${o.type}:${o.name}` : o.type))
    console.log(`[llm] ${event.type} status=${event.response.status} output=[${output.join(", ")}]`)
    return
  }
  console.log(`[llm] ${JSON.stringify(rest)}`)
}
