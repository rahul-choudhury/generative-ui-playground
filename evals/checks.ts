/**
 * Building blocks for eval expectations. Each returns a Check: a function
 * that inspects one turn's outcome and returns a failure message or null.
 * All plain code, no model-as-judge: cheaper, and deterministic.
 */
import type { Check, TurnOutcome, WidgetCall } from "./harness"

const describe = (turn: TurnOutcome) =>
  turn.widgets.length === 0 ? "no widget" : turn.widgets.map((w) => w.name).join(", ")

const find = (turn: TurnOutcome, name: string): WidgetCall | undefined =>
  turn.widgets.find((w) => w.name === name)

/** The turn calls this widget (possibly alongside others). */
export const uses =
  (name: string): Check =>
  (turn) =>
    find(turn, name) ? null : `expected ${name}, got ${describe(turn)}`

/** The turn calls no widget at all. */
export const noWidget = (): Check => (turn) =>
  turn.widgets.length === 0 ? null : `expected no widget, got ${describe(turn)}`

/** The turn doesn't call this widget (others are fine). */
export const notUses =
  (name: string): Check =>
  (turn) =>
    find(turn, name) ? `expected no ${name}, but it was called` : null

/** Every widget called is one of these. */
export const onlyFrom =
  (...names: string[]): Check =>
  (turn) => {
    const other = turn.widgets.find((w) => !names.includes(w.name))
    return other ? `unexpected ${other.name}` : null
  }

/** The widget's arguments satisfy `test`; `what` describes it on failure. */
export const args =
  <A>(name: string, what: string, test: (args: A) => boolean): Check =>
  (turn) => {
    const widget = find(turn, name)
    if (!widget) return `expected ${name} (to check: ${what}), got ${describe(turn)}`
    return test(widget.args as A) ? null : `${name}: expected ${what}, got ${JSON.stringify(widget.args)}`
  }

/** The fetched result for a data widget had this status. */
export const resultStatus =
  (name: string, status: "ok" | "error"): Check =>
  (turn) => {
    const widget = find(turn, name)
    if (!widget) return `expected ${name}, got ${describe(turn)}`
    return widget.result?.status === status ? null : `${name}: expected a ${status} result, got ${widget.result?.status ?? "none"}`
  }

/** The reply's text matches. */
export const text =
  (what: string, pattern: RegExp): Check =>
  (turn) =>
    pattern.test(turn.text) ? null : `expected text ${what}, got ${JSON.stringify(turn.text.slice(0, 200))}`

/** The reply's text does not match. */
export const textNot =
  (what: string, pattern: RegExp): Check =>
  (turn) =>
    pattern.test(turn.text) ? `expected text not ${what}, got ${JSON.stringify(turn.text.slice(0, 200))}` : null

/** Some text comes before the widget (e.g. advice the user asked for). */
export const textBefore =
  (name: string): Check =>
  (turn) => {
    const widgetAt = turn.parts.findIndex((p) => p.type === "widget" && p.name === name)
    if (widgetAt === -1) return `expected ${name}, got ${describe(turn)}`
    const before = turn.parts.slice(0, widgetAt).some((p) => p.type === "text" && p.text.trim().length > 20)
    return before ? null : `expected text before ${name}, got none`
  }

/** Whole-conversation check, for things that span turns. */
export const conversation =
  (what: string, test: (turns: TurnOutcome[]) => boolean): Check =>
  (_turn, turns) =>
    test(turns) ? null : `expected ${what}`
