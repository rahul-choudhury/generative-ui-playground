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

// Step 2 adds a widget part to this union.
export const PartSchema = z.discriminatedUnion("type", [TextPartSchema])

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(PartSchema),
})

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
})

export type TextPart = z.infer<typeof TextPartSchema>
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
  | { type: "usage"; usage: Usage }
  | { type: "done" }
  | { type: "error"; message: string }
