/**
 * Every widget the model can use. Safe for the server: no React.
 *
 * To add a widget: create widgets/<name>/definition.ts + component.tsx, then
 * add it here AND in components.ts (the type check fails if you forget).
 */
import { checklist } from "./checklist/definition"
import { choices } from "./choices/definition"
import type { z } from "zod"
import type { WidgetDefinition } from "./define"
import { factCard } from "./fact-card/definition"
import { weather } from "./weather/definition"

export const definitions = [checklist, factCard, choices, weather] as const

export type WidgetName = (typeof definitions)[number]["name"]

// Per-widget types, used to type-check the component registry (client) and
// the resolver registry (server) against each widget's own schemas.
type DefinitionOf<N extends WidgetName> = Extract<(typeof definitions)[number], { name: N }>
export type ArgsOf<N extends WidgetName> = z.infer<DefinitionOf<N>["schema"]>
export type StateOf<N extends WidgetName> =
  DefinitionOf<N> extends WidgetDefinition<string, z.ZodObject, infer S> ? z.infer<S> : never
export type ResultOf<N extends WidgetName> =
  DefinitionOf<N> extends WidgetDefinition<string, z.ZodObject, z.ZodType, infer R> ? z.infer<R> : never
/** Widgets that declare a result, i.e. need a server-side resolver. */
export type DataWidgetName = {
  [N in WidgetName]: ResultOf<N> extends undefined ? never : N
}[WidgetName]

/** Look up by the name the model sent. Undefined for unknown names. */
const byName = new Map<string, WidgetDefinition>(definitions.map((d) => [d.name, d]))
export const getDefinition = (name: string) => byName.get(name)

// Two widgets with one name would silently shadow each other.
if (byName.size !== definitions.length) {
  throw new Error(`Duplicate widget names in widgets/definitions.ts`)
}
