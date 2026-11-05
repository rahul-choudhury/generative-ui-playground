/**
 * Helpers for reading arguments that are still streaming. A partial value is
 * whatever parsePartialJson made of an unfinished document, so it can't be
 * schema-validated yet: these read it defensively, field by field, and
 * ignore anything of the wrong type instead of throwing.
 */

export const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

export const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
