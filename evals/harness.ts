/**
 * Runs scripted conversations against the real model through the same
 * streamChat the server uses, and records what happened in each turn:
 * which widgets were called with what, any fetched data, the text, cost.
 */
import { streamChat } from "../server/llm/stream"
import type { Message, Part, StreamEvent, ToolResult } from "../shared/protocol"
import { fixedData } from "./fixed-data"

// ─── Cases ──────────────────────────────────────────────────────────────────

/** Returns a failure message, or null if the check passed. */
export type Check = (turn: TurnOutcome, conversation: TurnOutcome[]) => string | null

export type Turn =
  /** The user types a message. */
  | { user: string; expect: Check[] }
  /** The user clicks option `pick` (0-based) in the last choice widget. */
  | { pick: number; expect: Check[] }
  /** The user ticks items (0-based) in the last checklist, then types. */
  | { tick: number[]; user: string; expect: Check[] }

export type Case = {
  name: string
  /** Groups cases in the report, e.g. "should use", "should not use". */
  group: string
  turns: Turn[]
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

export type WidgetCall = { id: string; name: string; args: unknown; result?: ToolResult }

export type TurnOutcome = {
  /** Parts in order, as the client would render them. */
  parts: Part[]
  widgets: WidgetCall[]
  /** All text in the reply, joined. */
  text: string
  /** Model requests made (2 for a data widget's second pass). */
  requests: number
  costUsd: number
  /** Wall-clock time for the whole turn, both passes included. */
  ms: number
  error?: string
}

export type CaseRun = { passed: boolean; failures: string[]; turns: TurnOutcome[]; costUsd: number }

export async function runCase(testCase: Case, { timeoutMs = 120_000 } = {}): Promise<CaseRun> {
  const messages: Message[] = []
  const turns: TurnOutcome[] = []
  const failures: string[] = []

  for (const [index, turn] of testCase.turns.entries()) {
    const user = userMessage(turn, turns)
    if (typeof user === "string") {
      failures.push(`turn ${index + 1}: ${user}`)
      break
    }
    messages.push(user)

    const outcome = await runTurn(messages, timeoutMs)
    turns.push(outcome)
    messages.push({ id: crypto.randomUUID(), role: "assistant", parts: outcome.parts })

    if (outcome.error) {
      failures.push(`turn ${index + 1}: stream error: ${outcome.error}`)
      break
    }
    for (const check of turn.expect) {
      const failure = check(outcome, turns)
      if (failure) failures.push(`turn ${index + 1}: ${failure}`)
    }
  }

  const costUsd = turns.reduce((sum, t) => sum + t.costUsd, 0)
  return { passed: failures.length === 0, failures, turns, costUsd }
}

/** The user's side of a turn. A string means the turn couldn't be built. */
function userMessage(turn: Turn, previous: TurnOutcome[]): Message | string {
  const id = crypto.randomUUID()
  if ("pick" in turn) {
    const widget = lastWidget(previous, "show_choices")
    const options = (widget?.args as { options?: { label: string }[] } | undefined)?.options
    const option = options?.[turn.pick]
    if (!widget || !option) return `can't pick option ${turn.pick + 1}: no such choice was offered`
    return {
      id,
      role: "user",
      parts: [
        { type: "widget-state", widgetId: widget.id, state: { picked: turn.pick } },
        { type: "text", text: option.label },
      ],
    }
  }
  if ("tick" in turn) {
    const widget = lastWidget(previous, "show_checklist")
    const items = (widget?.args as { items?: { checked: boolean }[] } | undefined)?.items
    if (!widget || !items) return "can't tick items: no checklist was shown"
    const state = items.map((item, i) => item.checked || turn.tick.includes(i))
    return {
      id,
      role: "user",
      parts: [
        { type: "widget-state", widgetId: widget.id, state },
        { type: "text", text: turn.user },
      ],
    }
  }
  return { id, role: "user", parts: [{ type: "text", text: turn.user }] }
}

export function lastWidget(turns: TurnOutcome[], name: string): WidgetCall | undefined {
  return turns.flatMap((t) => t.widgets).findLast((w) => w.name === name)
}

/** Collapse the event stream into parts, the way the client does. */
async function runTurn(messages: Message[], timeoutMs: number): Promise<TurnOutcome> {
  const parts: Part[] = []
  const widgets = new Map<string, WidgetCall>()
  let requests = 0
  let costUsd = 0
  let error: string | undefined

  const apply = (event: StreamEvent) => {
    switch (event.type) {
      case "text-delta": {
        const last = parts.at(-1)
        if (last?.type === "text") last.text += event.delta
        else parts.push({ type: "text", text: event.delta })
        break
      }
      case "tool-call-start": {
        const call: WidgetCall = { id: event.id, name: event.name, args: undefined }
        widgets.set(event.id, call)
        parts.push({ type: "widget", id: event.id, name: event.name })
        break
      }
      case "tool-call-end":
      case "tool-result": {
        const call = widgets.get(event.id)
        const part = parts.find((p) => p.type === "widget" && p.id === event.id)
        if (!call || part?.type !== "widget") break
        if (event.type === "tool-call-end") call.args = part.args = event.args
        else call.result = part.result = event.result
        break
      }
      case "usage":
        requests++
        costUsd += event.usage.costUsd ?? 0
        break
      case "error":
        error = event.message
        break
    }
  }

  const started = performance.now()
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    for await (const event of streamChat(messages, signal, fixedData)) apply(event)
  } catch (e) {
    error = signal.aborted ? `timed out after ${timeoutMs / 1000}s` : String(e)
  }

  return {
    parts,
    widgets: [...widgets.values()],
    text: parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n").trim(),
    requests,
    costUsd,
    ms: Math.round(performance.now() - started),
    error,
  }
}
