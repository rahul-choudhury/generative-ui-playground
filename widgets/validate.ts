/**
 * The one place that decides whether a widget call is renderable. Used by the
 * client (what to show), the server (what to tell the model in history) and
 * the server's stream logging, so all three always agree.
 */
import type { z } from "zod"
import { getDefinition } from "./definitions"

export type WidgetValidation =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "unknown" }
  | { status: "invalid"; issues: string[] }

export function validateWidget(name: string, args: unknown): WidgetValidation {
  const definition = getDefinition(name)
  if (!definition) return { status: "unknown" }

  const result = definition.schema.safeParse(args)
  return result.success
    ? { status: "ok", data: result.data as Record<string, unknown> }
    : { status: "invalid", issues: formatIssues(result.error.issues) }
}

/** "facts: Too small: expected array to have >=2 items" etc. */
export function formatIssues(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join(".")
    return path ? `${path}: ${issue.message}` : issue.message
  })
}
