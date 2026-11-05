/**
 * Widget name → React component. Client only.
 *
 * The type below makes this registry complete and correct: every name in
 * definitions.ts needs an entry, and each Component must accept exactly the
 * arguments its schema produces and the state its state schema describes.
 */
import type { ComponentType } from "react"
import type { z } from "zod"
import { Checklist, ChecklistPending } from "./checklist/component"
import { ChecklistSkeleton } from "./checklist/skeleton"
import { Choices, ChoicesPending } from "./choices/component"
import { ChoicesSkeleton } from "./choices/skeleton"
import type { WidgetDefinition, WidgetProps } from "./define"
import type { definitions, WidgetName } from "./definitions"
import { FactCard, FactCardPending } from "./fact-card/component"
import { FactCardSkeleton } from "./fact-card/skeleton"

type DefinitionOf<N extends WidgetName> = Extract<(typeof definitions)[number], { name: N }>
type ArgsOf<N extends WidgetName> = z.infer<DefinitionOf<N>["schema"]>
type StateOf<N extends WidgetName> =
  DefinitionOf<N> extends WidgetDefinition<string, z.ZodObject, infer S> ? z.infer<S> : never

export type WidgetEntry<Args, State> = {
  /** The finished widget, given validated arguments and its current state. */
  Component: ComponentType<WidgetProps<Args, State>>
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

export const components: { [N in WidgetName]: WidgetEntry<ArgsOf<N>, StateOf<N>> } = {
  show_checklist: { Component: Checklist, Pending: ChecklistPending, Skeleton: ChecklistSkeleton },
  show_fact_card: { Component: FactCard, Pending: FactCardPending, Skeleton: FactCardSkeleton },
  show_choices: { Component: Choices, Pending: ChoicesPending, Skeleton: ChoicesSkeleton },
}

/**
 * Look up by the name the model sent. The cast is safe because the registry
 * type above ties each component to its schema, and the caller validates args
 * with that same schema before rendering.
 */
export function getComponents(name: string): WidgetEntry<Record<string, unknown>, unknown> | undefined {
  return Object.hasOwn(components, name)
    ? (components[name as WidgetName] as unknown as WidgetEntry<Record<string, unknown>, unknown>)
    : undefined
}
