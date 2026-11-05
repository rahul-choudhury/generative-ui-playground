/**
 * The shape every widget definition follows. No React: definitions are
 * imported by the server to build the model's tools.
 */
import { z } from "zod"

/**
 * A string the model must actually fill in. OpenAI strict mode enforces the
 * resulting minLength (no ""), but not "non-blank": it was observed sending
 * " " and ". ". trim() runs in Zod only, so blank values fail validation.
 */
export const text = () => z.string().trim().min(1)

/**
 * State the user can change by interacting with a widget (e.g. ticks). Kept
 * by the client, sent as a snapshot with the user's next message, and turned
 * into words for the model by the server. No React: the server runs it.
 */
export type WidgetStateConfig<Args, StateSchema extends z.ZodType> = {
  /** Validates a snapshot from the client before it's described. */
  schema: StateSchema
  /** The state the widget starts in, derived from the model's arguments. */
  initial: (args: Args) => z.infer<StateSchema>
  /**
   * One sentence telling the model what changed, or null if nothing did.
   * `before` is the last state the model heard about.
   */
  describeChange: (args: Args, before: z.infer<StateSchema>, after: z.infer<StateSchema>) => string | null
}

/**
 * Data the server fetches for a widget after the model calls it (e.g. a
 * forecast for the place it named): the model supplies intent, the backend
 * supplies facts. Only the shape and the model-facing summary live here; the
 * fetching itself is server-only (server/widgets/resolvers.ts).
 */
export type WidgetResultConfig<Args, ResultSchema extends z.ZodType> = {
  /** Validates fetched data wherever it's used (client render, history). */
  schema: ResultSchema
  /**
   * What the model is told was shown: the facts it needs to talk about it,
   * in compact text. Used both in the same turn (the second pass) and in
   * later turns' history, so it's identical in both.
   */
  summarize: (args: Args, data: z.infer<ResultSchema>) => string
}

export type WidgetDefinition<
  Name extends string = string,
  Schema extends z.ZodObject = z.ZodObject,
  StateSchema extends z.ZodType = z.ZodType,
  ResultSchema extends z.ZodType = z.ZodType,
> = {
  /** Tool name the model calls, e.g. "show_checklist". Must be unique. */
  name: Name
  /** Lowercase noun for UI text, e.g. "checklist" → "The checklist was interrupted". */
  label: string
  /** Tells the model when to use this widget, when not to, and what to use instead. */
  description: string
  /** Arguments the model must send. Also validates them before rendering. */
  schema: Schema
  /** Only for interactive widgets. */
  state?: WidgetStateConfig<z.infer<Schema>, StateSchema>
  /** Only for data widgets: the server fetches this after the call. */
  result?: WidgetResultConfig<z.infer<Schema>, ResultSchema>
}

/**
 * Identity function whose only job is inference: it keeps the literal name
 * and the exact argument, state and result schemas, so the component and
 * resolver registries can be type-checked against each widget. A widget
 * without `state` or `result` gets type `undefined` for it.
 */
export function defineWidget<
  const Name extends string,
  Schema extends z.ZodObject,
  StateSchema extends z.ZodType = z.ZodUndefined,
  ResultSchema extends z.ZodType = z.ZodUndefined,
>(
  definition: WidgetDefinition<Name, Schema, StateSchema, ResultSchema>
): WidgetDefinition<Name, Schema, StateSchema, ResultSchema> {
  return definition
}

/** Props every finished widget component receives. */
export type WidgetProps<Args, State, Result = undefined> = {
  args: Args
  /** Data widgets: what the server fetched (undefined for other widgets). */
  result: Result
  /** Current interactive state (undefined for widgets without state). */
  state: State
  /**
   * Change state silently: the model hears about it with the user's next
   * message (e.g. ticking checklist items).
   */
  setState: (next: State) => void
  /**
   * Send a message as the user right now, optionally with a new state, and
   * get a reply (e.g. picking an option). For interactions that answer the
   * model, rather than ones it should simply know about later.
   */
  respond: (message: string, state?: State) => void
  /**
   * False while a reply is streaming, or once the conversation has moved on
   * past this widget's message. Widgets that respond should lock then.
   */
  canRespond: boolean
}
