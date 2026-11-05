/**
 * Our message shape → Responses API input items, keeping part order.
 * Deliberately free of the OpenAI client so it can be unit-tested.
 */
import type { ResponseInputItem } from "openai/resources/responses/responses"
import type { Message, WidgetPart } from "../../shared/protocol"
import { validateWidget } from "../../widgets/validate"

/**
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
      items.push({ type: "function_call_output", call_id: part.id, output: widgetOutput(part) })
    }
    flushText()
  }

  return items
}

/**
 * What the model is told happened to its widget. Re-validated here rather
 * than trusted from the client, using the same check the client renders with,
 * so the model hears the truth: e.g. if its arguments were rejected, the next
 * turn knows the user saw an error, not the widget.
 */
export function widgetOutput(part: WidgetPart): string {
  const result = validateWidget(part.name, part.args)
  switch (result.status) {
    case "ok":
      // Step 6 replaces this with the widget's live state (e.g. ticked items).
      return "Shown to the user."
    case "unknown":
      return `Not shown: there is no widget named "${part.name}". The user saw an error message instead.`
    case "invalid":
      return `Not shown: invalid arguments (${result.issues.join("; ")}). The user saw an error message instead.`
  }
}
