/**
 * Our message shape → Responses API input items, keeping part order.
 * Deliberately free of the OpenAI client so it can be unit-tested.
 */
import type { ResponseInputItem } from "openai/resources/responses/responses"
import type { Message, WidgetPart, WidgetStatePart } from "../../shared/protocol"
import type { WidgetDefinition } from "../../widgets/define"
import { getDefinition } from "../../widgets/definitions"
import { validateWidget } from "../../widgets/validate"

/** What history needs to know about a widget to describe changes to it. */
type TrackedWidget = { definition: WidgetDefinition; args: Record<string, unknown>; state: unknown }

/**
 * A widget part becomes a function_call plus its function_call_output: the
 * API rejects a call without a matching output. We send only call_id (never
 * OpenAI's item ids) because with store: false those items don't exist
 * server-side.
 *
 * A widget-state part (on a user message) becomes a short note, placed just
 * before the user's text, saying what they changed since the model last
 * heard. History only ever grows at the end this way, which keeps OpenAI's
 * prompt cache valid: rewriting an earlier function_call_output on every tick
 * would invalidate everything after it.
 */
export function toOpenAIInput(messages: Message[]): ResponseInputItem[] {
  const items: ResponseInputItem[] = []
  // Walked in order, so each snapshot is compared with the previous one.
  const widgets = new Map<string, TrackedWidget>()

  for (const message of messages) {
    let text = ""
    const flushText = () => {
      if (text) items.push({ role: message.role, content: text })
      text = ""
    }
    const events: string[] = []
    const flushEvents = () => {
      if (events.length === 0) return
      items.push({ role: "user", content: formatEvents(events) })
      events.length = 0
    }

    for (const part of message.parts) {
      switch (part.type) {
        case "text":
          flushEvents() // events describe what happened before this text
          text += part.text
          break

        case "widget-state": {
          const event = describeStateChange(part, widgets)
          if (event) events.push(event)
          break
        }

        case "widget": {
          // A widget interrupted mid-stream (Stop) never got arguments; drop it.
          if (part.args === undefined) break
          flushText()
          items.push({
            type: "function_call",
            call_id: part.id,
            name: part.name,
            arguments: JSON.stringify(part.args),
          })
          items.push({ type: "function_call_output", call_id: part.id, output: widgetOutput(part) })
          track(part, widgets)
          break
        }
      }
    }
    flushEvents()
    flushText()
  }

  return items
}

/**
 * What the model is told happened to its widget. Re-validated here rather
 * than trusted from the client, using the same check the client renders with,
 * so the model hears the truth: e.g. if its arguments were rejected, the next
 * turn knows the user saw an error, not the widget. Never changes afterwards
 * (see toOpenAIInput); later interaction arrives as events instead.
 */
export function widgetOutput(part: WidgetPart): string {
  const result = validateWidget(part.name, part.args)
  switch (result.status) {
    case "ok":
      return dataWidgetOutput(part, result.data) ?? "Shown to the user."
    case "unknown":
      return `Not shown: there is no widget named "${part.name}". The user saw an error message instead.`
    case "invalid":
      return `Not shown: invalid arguments (${result.issues.join("; ")}). The user saw an error message instead.`
  }
}

/**
 * Data widgets: the fetched facts the model needs to talk about them (the
 * same text it got in the same turn's second pass), or why there were none.
 * Null for widgets without a result.
 */
function dataWidgetOutput(part: WidgetPart, args: Record<string, unknown>): string | null {
  const config = getDefinition(part.name)?.result
  if (!config) return null

  // Progressive widgets are shown whatever happens to their fetch.
  if (config.progressive) {
    const data = part.result?.status === "ok" ? config.schema.safeParse(part.result.data) : null
    if (data?.success) return config.summarize(args, data.data)
    return "Shown to the user, without its extra data (it couldn't be loaded)."
  }

  if (part.result === undefined) {
    return "Not shown: the reply was interrupted before the data was fetched."
  }
  if (part.result.status === "error") {
    // The second sentence matters: Terra was seen answering a failed fetch
    // with no text at all, leaving the user with only the error card.
    return `Not shown: ${part.result.message} The user saw this error instead. Tell them briefly and suggest what they could do (e.g. check the spelling, add the country).`
  }
  const data = config.schema.safeParse(part.result.data)
  if (!data.success) return "Not shown: the fetched data was invalid. The user saw an error message instead."
  return config.summarize(args, data.data)
}

/** Remember a rendered, interactive widget and the state it starts in. */
function track(part: WidgetPart, widgets: Map<string, TrackedWidget>) {
  const definition = getDefinition(part.name)
  const result = validateWidget(part.name, part.args)
  if (!definition?.state || result.status !== "ok") return
  widgets.set(part.id, { definition, args: result.data, state: definition.state.initial(result.data) })
}

/**
 * Compare a snapshot with the last state the model heard about. Snapshots
 * for unknown widgets, or that fail the widget's state schema, are ignored:
 * the model is better told nothing than something wrong.
 */
function describeStateChange(part: WidgetStatePart, widgets: Map<string, TrackedWidget>): string | null {
  const widget = widgets.get(part.widgetId)
  const config = widget?.definition.state
  if (!widget || !config) return null

  const parsed = config.schema.safeParse(part.state)
  if (!parsed.success) return null

  const description = config.describeChange(widget.args, widget.state, parsed.data)
  widget.state = parsed.data
  return description
}

function formatEvents(events: string[]) {
  return [
    "<widget_events>",
    "Since your last reply, the user did this in widgets shown earlier:",
    ...events.map((event) => `- ${event}`),
    "</widget_events>",
  ].join("\n")
}
