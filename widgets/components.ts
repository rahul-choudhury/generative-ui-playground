/**
 * Widget name → React component. Client only.
 *
 * The type below makes this registry complete and correct: every name in
 * definitions.ts needs an entry, and each Component must accept exactly the
 * arguments its schema produces.
 */
import type { ComponentType } from "react"
import type { z } from "zod"
import { Checklist, ChecklistPending } from "./checklist/component"
import { ChecklistSkeleton } from "./checklist/skeleton"
import type { definitions, WidgetName } from "./definitions"
import { FactCard, FactCardPending } from "./fact-card/component"
import { FactCardSkeleton } from "./fact-card/skeleton"

type ArgsOf<N extends WidgetName> = z.infer<
  Extract<(typeof definitions)[number], { name: N }>["schema"]
>

export type WidgetEntry<Args> = {
  /** The finished widget, given validated arguments. */
  Component: ComponentType<Args>
  /**
   * The widget while its arguments stream, given whatever has been parsed so
   * far. `partial` is unvalidated, so it's typed unknown: read it
   * defensively (see widgets/partial.ts). `interrupted` is set when the reply
   * stopped first: the view stays, frozen, but is no longer loading.
   * Optional: without a Pending view, the skeleton stays up.
   */
  Pending?: ComponentType<{ partial: unknown; interrupted?: boolean }>
  /** Shown before any arguments arrive. Falls back to a generic placeholder. */
  Skeleton?: ComponentType
}

export const components: { [N in WidgetName]: WidgetEntry<ArgsOf<N>> } = {
  show_checklist: { Component: Checklist, Pending: ChecklistPending, Skeleton: ChecklistSkeleton },
  show_fact_card: { Component: FactCard, Pending: FactCardPending, Skeleton: FactCardSkeleton },
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
