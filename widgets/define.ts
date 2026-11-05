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

export type WidgetDefinition<
  Name extends string = string,
  Schema extends z.ZodObject = z.ZodObject,
  StateSchema extends z.ZodType = z.ZodType,
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
}

/**
 * Identity function whose only job is inference: it keeps the literal name,
 * the exact argument schema and the state schema, so the component registry
 * can be type-checked against each widget's own arguments and state. A widget
 * without `state` gets state type `undefined`.
 */
export function defineWidget<
  const Name extends string,
  Schema extends z.ZodObject,
  StateSchema extends z.ZodType = z.ZodUndefined,
>(definition: WidgetDefinition<Name, Schema, StateSchema>): WidgetDefinition<Name, Schema, StateSchema> {
  return definition
}

/** Props every finished widget component receives. */
export type WidgetProps<Args, State> = {
  args: Args
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
