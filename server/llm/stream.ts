import type {
  FunctionTool,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses"
import type { Message, StreamEvent, ToolResult } from "../../shared/protocol"
import { validateWidget } from "../../widgets/validate"
import { hasResolver, resolveWidget } from "../widgets/resolvers"
import { toOpenAIInput, widgetOutput } from "./history"
import { toUsage } from "./models"
import { model, openai } from "./openai"
import { toolsExcept } from "./tools"
import { systemPrompt } from "./system-prompt"

/**
 * Calls OpenAI and yields our own StreamEvents. This is the only place that
 * knows OpenAI's event names; swapping providers means rewriting this file.
 *
 * Usually one model request per turn: a widget call ends the reply. Data
 * widgets (those with a server resolver, e.g. weather) get a second pass:
 * the model only named a place, so once the server has fetched the facts
 * they're sent back to it and it continues, answering from real data.
 */
/** Where data widgets get their data. Swappable so evals can use fixed data. */
export type DataSource = {
  hasResolver: (name: string) => boolean
  resolveWidget: (name: string, args: unknown, signal: AbortSignal) => Promise<ToolResult>
}

const liveData: DataSource = { hasResolver, resolveWidget }

export async function* streamChat(
  messages: Message[],
  signal: AbortSignal,
  data: DataSource = liveData
): AsyncGenerator<StreamEvent> {
  try {
    let input = toOpenAIInput(messages)

    // Rules enforced by which tools are offered, not just asked for in
    // descriptions (evals showed the model breaking them occasionally):
    // - right after the user answered a choice, no second choice in a row
    // - the second pass can show widgets, but can't start another fetch
    const justAnsweredChoice = messages
      .findLast((m) => m.role === "assistant")
      ?.parts.some((p) => p.type === "widget" && p.name === "show_choices")
    const excluded = (name: string, pass: number) =>
      (justAnsweredChoice && name === "show_choices") || (pass === 2 && data.hasResolver(name))

    for (let pass = 1; pass <= 2; pass++) {
      const available = toolsExcept((name) => excluded(name, pass))
      const outcome = yield* streamPass(input, { signal, tools: available, data })
      if (outcome.kind === "stopped") return // error already reported

      // Wait for any data still being fetched, and send it to the client.
      const results = new Map<string, ToolResult>()
      for (const [id, pending] of outcome.fetches) {
        const result = await pending
        results.set(id, result)
        yield { type: "tool-result", id, result }
      }
      // A second pass only happens when there's fetched data to answer from
      // (a widget it calls, e.g. a checklist, needs no further pass).
      if (outcome.fetches.size === 0 || pass === 2) break

      // Second pass: this response's output (including encrypted reasoning,
      // which OpenAI recommends passing back between tool turns), then an
      // output for every call. Data widgets get their facts; others the same
      // text history would give them, so later turns read identically.
      input = [
        ...input,
        ...outcome.output.flatMap(toInputItem),
        ...outcome.calls.map((call): ResponseInputItem => ({
          type: "function_call_output",
          call_id: call.id,
          output: widgetOutput({ type: "widget", ...call, result: results.get(call.id) }),
        })),
      ]
    }

    yield { type: "done" }
  } catch (err) {
    if (signal.aborted) return // the client hit Stop; nobody is listening
    console.error(err)
    yield { type: "error", message: err instanceof Error ? err.message : "Unknown error" }
  }
}

type PassOutcome =
  | { kind: "stopped" }
  | {
      kind: "completed"
      output: ResponseOutputItem[]
      calls: { id: string; name: string; args: unknown }[]
      /** Data being fetched, keyed by call id. Started as soon as args end. */
      fetches: Map<string, Promise<ToolResult>>
    }

/** One model request, streamed as our events. */
async function* streamPass(
  input: ResponseInputItem[],
  { signal, tools, data }: { signal: AbortSignal; tools: FunctionTool[]; data: DataSource }
): AsyncGenerator<StreamEvent, PassOutcome> {
  const stream = await openai.responses.create(
    {
      model,
      instructions: systemPrompt,
      input,
      tools,
      tool_choice: tools.length > 0 ? "auto" : "none",
      include: ["reasoning.encrypted_content"],
      stream: true,
      store: false, // stateless: the client sends the full history each time
    },
    { signal }
  )

  // Argument deltas carry OpenAI's item_id, not the call_id we use as the
  // widget id, so remember the mapping from output_item.added.
  const callIdByItemId = new Map<string, string>()
  const calls: { id: string; name: string; args: unknown }[] = []
  const fetches = new Map<string, Promise<ToolResult>>()
  let output: ResponseOutputItem[] = []

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
          const { call_id: id, name } = event.item
          const args = parseArgs(event.item.arguments)
          logIfUnrenderable(name, args)
          yield { type: "tool-call-end", id, args }
          calls.push({ id, name, args })
          // Start fetching now, overlapping with the rest of the stream.
          if (data.hasResolver(name)) fetches.set(id, data.resolveWidget(name, args, signal))
        }
        break

      // Usage only arrives in these final events. A reply cut off by Stop
      // never gets one, so its cost stays unknown. Each pass reports its
      // own usage; the client adds them up.
      case "response.completed": {
        const usage = toUsage(event.response)
        if (usage) yield { type: "usage", usage }
        output = event.response.output
        break
      }

      case "response.failed": {
        const usage = toUsage(event.response)
        if (usage) yield { type: "usage", usage } // partial work is still billed
        yield {
          type: "error",
          message: event.response.error?.message ?? "The model failed to respond.",
        }
        return { kind: "stopped" }
      }

      case "response.incomplete": {
        const usage = toUsage(event.response)
        if (usage) yield { type: "usage", usage }
        yield {
          type: "error",
          message: `Response cut off (${event.response.incomplete_details?.reason ?? "unknown reason"}).`,
        }
        return { kind: "stopped" }
      }

      case "error":
        yield { type: "error", message: event.message }
        return { kind: "stopped" }

      // Everything else (created, in_progress, reasoning, item added/done…)
      // isn't needed.
    }
  }

  return { kind: "completed", output, calls, fetches }
}

/**
 * A response output item as next-pass input. Function calls go back without
 * OpenAI's item ids (with store: false those items don't exist server-side),
 * the same shape history uses. Reasoning goes back whole, encrypted content
 * included. Messages become plain assistant text.
 */
function toInputItem(item: ResponseOutputItem): ResponseInputItem[] {
  switch (item.type) {
    case "reasoning":
      return [item]
    case "function_call":
      return [{ type: "function_call", call_id: item.call_id, name: item.name, arguments: item.arguments }]
    case "message": {
      const text = item.content.map((part) => (part.type === "output_text" ? part.text : "")).join("")
      return text ? [{ role: "assistant", content: text }] : []
    }
    default:
      return []
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

/**
 * The client shows a fallback for these; logging here puts the reason in the
 * server terminal too, not just the browser console. Args still go to the
 * client unchanged: it renders the fallback (with details) itself.
 */
function logIfUnrenderable(name: string, args: unknown) {
  const result = validateWidget(name, args)
  if (result.status === "unknown") console.warn(`[widget] unknown widget "${name}"`)
  if (result.status === "invalid") {
    console.warn(`[widget] invalid ${name} arguments:\n  ${result.issues.join("\n  ")}`)
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
