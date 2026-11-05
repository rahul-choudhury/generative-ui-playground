/**
 * The shape every widget definition follows. No React: definitions are
 * imported by the server to build the model's tools.
 */
import type { z } from "zod"

export type WidgetDefinition<
  Name extends string = string,
  Schema extends z.ZodObject = z.ZodObject,
> = {
  /** Tool name the model calls, e.g. "show_checklist". Must be unique. */
  name: Name
  /** Lowercase noun for UI text, e.g. "checklist" → "The checklist was interrupted". */
  label: string
  /** Tells the model when to use this widget, when not to, and what to use instead. */
  description: string
  /** Arguments the model must send. Also validates them before rendering. */
  schema: Schema
}

/**
 * Identity function whose only job is inference: it keeps the literal name
 * and the exact schema type, so the component registry can be type-checked
 * against each widget's own arguments.
 */
export function defineWidget<const Name extends string, Schema extends z.ZodObject>(
  definition: WidgetDefinition<Name, Schema>
): WidgetDefinition<Name, Schema> {
  return definition
}
