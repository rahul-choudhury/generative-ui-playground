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

export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string }
