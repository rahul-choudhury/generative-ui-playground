/**
 * Widget name → React component. Client only.
 *
 * The type below makes this registry complete and correct: every name in
 * definitions.ts needs an entry, and each Component must accept exactly the
 * arguments its schema produces and the state its state schema describes.
 */
import type { ComponentType } from "react"
import { Checklist, ChecklistPending } from "./checklist/component"
import { ChecklistSkeleton } from "./checklist/skeleton"
import { Choices, ChoicesPending } from "./choices/component"
import { ChoicesSkeleton } from "./choices/skeleton"
import type { WidgetProps } from "./define"
import type { ArgsOf, ResultOf, StateOf, WidgetName } from "./definitions"
import { FactCard, FactCardPending } from "./fact-card/component"
import { FactCardSkeleton } from "./fact-card/skeleton"
import { Weather, WeatherPending, WeatherSkeleton } from "./weather/component"

export type WidgetEntry<Args, State, Result> = {
  /**
   * The finished widget, given validated arguments, its current state, and
   * (data widgets) the validated data the server fetched.
   */
  Component: ComponentType<WidgetProps<Args, State, Result>>
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

export const components: { [N in WidgetName]: WidgetEntry<ArgsOf<N>, StateOf<N>, ResultOf<N>> } = {
  show_checklist: { Component: Checklist, Pending: ChecklistPending, Skeleton: ChecklistSkeleton },
  show_fact_card: { Component: FactCard, Pending: FactCardPending, Skeleton: FactCardSkeleton },
  show_choices: { Component: Choices, Pending: ChoicesPending, Skeleton: ChoicesSkeleton },
  show_weather: { Component: Weather, Pending: WeatherPending, Skeleton: WeatherSkeleton },
}

/**
 * Look up by the name the model sent. The cast is safe because the registry
 * type above ties each component to its schema, and the caller validates args
 * with that same schema before rendering.
 */
export function getComponents(name: string): WidgetEntry<Record<string, unknown>, unknown, unknown> | undefined {
  return Object.hasOwn(components, name)
    ? (components[name as WidgetName] as unknown as WidgetEntry<Record<string, unknown>, unknown, unknown>)
    : undefined
}
