/**
 * Server-only: fetches the data for widgets that declare a `result` (the
 * model supplies intent, the backend supplies facts). Kept out of widgets/
 * so fetch code, and any API keys a future resolver needs, never reach the
 * browser.
 *
 * The type below makes this complete: every widget with a result schema
 * needs a resolver here, returning exactly that result type.
 */
import type { ToolResult } from "../../shared/protocol"
import type { ArgsOf, DataWidgetName, ResultOf } from "../../widgets/definitions"
import { validateWidget } from "../../widgets/validate"
import { ResolveError } from "./resolve-error"
import { resolveRecipe } from "./recipe"
import { resolveWeather } from "./weather"

type Resolver<N extends DataWidgetName> = (args: ArgsOf<N>, signal: AbortSignal) => Promise<ResultOf<N>>

const resolvers: { [N in DataWidgetName]: Resolver<N> } = {
  show_weather: resolveWeather,
  show_recipe: resolveRecipe,
}

export const hasResolver = (name: string): name is DataWidgetName => Object.hasOwn(resolvers, name)

/**
 * Fetch a widget's data. Never throws for data problems: a failure becomes
 * an error result the widget and the model both see. Only a user abort
 * (Stop) propagates, so the stream can end.
 */
export async function resolveWidget(name: string, args: unknown, signal: AbortSignal): Promise<ToolResult> {
  if (!hasResolver(name)) return { status: "error", message: "This widget has no data source." }

  // Resolve from validated (and trimmed) arguments, never raw model output.
  const validated = validateWidget(name, args)
  if (validated.status !== "ok") return { status: "error", message: "The request for this widget was invalid." }

  const resolver = resolvers[name] as (args: unknown, signal: AbortSignal) => Promise<unknown>
  try {
    return { status: "ok", data: await resolver(validated.data, signal) }
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof ResolveError) return { status: "error", message: error.message }
    console.error(`[widget] ${name} resolver failed`, error)
    return { status: "error", message: "Something went wrong fetching this data." }
  }
}
