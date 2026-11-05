/**
 * Widget name → React component. Client only.
 *
 * The type below makes this registry complete and correct: every name in
 * definitions.ts needs an entry, and each Component must accept exactly the
 * arguments its schema produces.
 */
import type { ComponentType } from "react"
import type { z } from "zod"
import { Checklist } from "./checklist/component"
import { ChecklistSkeleton } from "./checklist/skeleton"
import type { definitions, WidgetName } from "./definitions"
import { FactCard } from "./fact-card/component"
import { FactCardSkeleton } from "./fact-card/skeleton"

type ArgsOf<N extends WidgetName> = z.infer<
  Extract<(typeof definitions)[number], { name: N }>["schema"]
>

export type WidgetEntry<Args> = {
  Component: ComponentType<Args>
  /** Shown while arguments stream. Falls back to a generic placeholder. */
  Skeleton?: ComponentType
}

export const components: { [N in WidgetName]: WidgetEntry<ArgsOf<N>> } = {
  show_checklist: { Component: Checklist, Skeleton: ChecklistSkeleton },
  show_fact_card: { Component: FactCard, Skeleton: FactCardSkeleton },
}

/**
 * Look up by the name the model sent. The cast is safe because the registry
 * type above ties each component to its schema, and the caller validates args
 * with that same schema before rendering.
 */
export function getComponents(name: string): WidgetEntry<Record<string, unknown>> | undefined {
  return Object.hasOwn(components, name)
    ? (components[name as WidgetName] as unknown as WidgetEntry<Record<string, unknown>>)
    : undefined
}
