/**
 * Every widget the model can use. Safe for the server: no React.
 *
 * To add a widget: create widgets/<name>/definition.ts + component.tsx, then
 * add it here AND in components.ts (the type check fails if you forget).
 */
import { checklist } from "./checklist/definition"
import { choices } from "./choices/definition"
import type { WidgetDefinition } from "./define"
import { factCard } from "./fact-card/definition"

export const definitions = [checklist, factCard, choices] as const

export type WidgetName = (typeof definitions)[number]["name"]

/** Look up by the name the model sent. Undefined for unknown names. */
const byName = new Map<string, WidgetDefinition>(definitions.map((d) => [d.name, d]))
export const getDefinition = (name: string) => byName.get(name)

// Two widgets with one name would silently shadow each other.
if (byName.size !== definitions.length) {
  throw new Error(`Duplicate widget names in widgets/definitions.ts`)
}
