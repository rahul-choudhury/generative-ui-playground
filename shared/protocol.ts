/**
 * The contract between client and server. Nothing in here knows about
 * OpenAI — the server translates whatever the provider sends into these
 * shapes, so the client never changes when the provider does.
 */
import { z } from "zod"

// ─── Messages (client → server) ────────────────────────────────────────────

export const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

/**
 * A widget the model asked to show. `id` is the provider's tool-call id.
 * `args` is undefined while the arguments are still streaming, and is NOT
 * validated here: the client checks it against the widget's own schema.
 */
export const WidgetPartSchema = z.object({
  type: z.literal("widget"),
  id: z.string(),
  name: z.string(),
  args: z.unknown().optional(),
})

/**
 * Sent on a user message: the current state of a widget the user interacted
 * with since their last message (e.g. a checklist's ticks). `widgetId` is the
 * widget part's id. The server compares it with the previous snapshot (or the
 * widget's initial state) and tells the model what changed. Not validated
 * here: the server checks it against the widget's state schema.
 */
export const WidgetStatePartSchema = z.object({
  type: z.literal("widget-state"),
  widgetId: z.string(),
  state: z.unknown(),
})

export const PartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  WidgetPartSchema,
  WidgetStatePartSchema,
])

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(PartSchema),
})

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
})

export type TextPart = z.infer<typeof TextPartSchema>
export type WidgetPart = z.infer<typeof WidgetPartSchema>
export type WidgetStatePart = z.infer<typeof WidgetStatePartSchema>
export type Part = z.infer<typeof PartSchema>
export type Message = z.infer<typeof MessageSchema>
export type ChatRequest = z.infer<typeof ChatRequestSchema>

// ─── Stream events (server → client, one JSON object per line) ─────────────

/**
 * Token usage and cost for one model response. Provider-neutral: the server
 * maps the provider's usage object onto this and prices it.
 *
 * cachedInputTokens and cacheWriteTokens are subsets of inputTokens;
 * reasoningTokens is a subset of outputTokens.
 */
export type Usage = {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
  reasoningTokens: number
  /** null when the model or service tier isn't in the server's price table. */
  costUsd: number | null
  /** Pricing tier the provider says it used, e.g. "standard". */
  serviceTier: string | null
  /** Most input tokens one request can take; null if the model is unknown. */
  maxInputTokens: number | null
  /** Input size above which the whole request is billed at long-context rates. */
  longContextThreshold: number | null
}

export type StreamEvent =
  | { type: "text-delta"; delta: string }
  // A widget call: start (name known, args not yet), raw argument chunks
  // (unused until step 5's partial rendering), then the parsed arguments.
  | { type: "tool-call-start"; id: string; name: string }
  | { type: "tool-call-delta"; id: string; delta: string }
  | { type: "tool-call-end"; id: string; args: unknown }
  | { type: "usage"; usage: Usage }
  | { type: "done" }
  | { type: "error"; message: string }
