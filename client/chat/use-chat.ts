import { useCallback, useRef, useState } from "react"
import type { Message, Part, StreamEvent, TextPart, Usage, WidgetPart } from "../../shared/protocol"
import { readNdjson } from "./read-ndjson"

/**
 * A widget part plus the raw argument text received so far. argsText is what
 * the partial view renders from while args is still undefined; it's
 * client-only and stripped before history is sent.
 */
export type ClientWidgetPart = WidgetPart & { argsText?: string }
export type ClientPart = TextPart | ClientWidgetPart

/** Client-only fields on top of the wire Message. Never sent to the server. */
export type ChatMessage = Omit<Message, "parts"> & {
  parts: ClientPart[]
  status: "streaming" | "done" | "stopped" | "error"
  error?: string
  /** Assistant messages only; missing when the reply was stopped. */
  usage?: Usage
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const isStreaming = messages.at(-1)?.status === "streaming"

  /** Apply a change to the assistant message currently being streamed. */
  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)))

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || abortRef.current) return

      const user: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: content }],
        status: "done",
      }
      const assistant: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [],
        status: "streaming",
      }

      // History to send: everything that finished cleanly, plus the new
      // user message. Client-only fields are stripped.
      const history: Message[] = [...messages, user]
        .filter((m) => m.status !== "error" && m.parts.length > 0)
        .map(({ id, role, parts }) => ({ id, role, parts: parts.map(toWirePart) }))

      setMessages((prev) => [...prev, user, assistant])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`Server responded ${res.status}: ${await res.text()}`)
        }

        for await (const event of readNdjson<StreamEvent>(res.body)) {
          switch (event.type) {
            case "text-delta":
              updateLast((m) => appendText(m, event.delta))
              break
            case "tool-call-start":
              updateLast((m) => ({
                ...m,
                parts: [...m.parts, { type: "widget", id: event.id, name: event.name }],
              }))
              break
            case "tool-call-delta":
              updateLast((m) => ({
                ...m,
                parts: m.parts.map((p) =>
                  p.type === "widget" && p.id === event.id
                    ? { ...p, argsText: (p.argsText ?? "") + event.delta }
                    : p
                ),
              }))
              break
            case "tool-call-end":
              updateLast((m) => ({
                ...m,
                parts: m.parts.map((p) =>
                  p.type === "widget" && p.id === event.id ? { ...p, args: event.args } : p
                ),
              }))
              break
            case "usage":
              updateLast((m) => ({ ...m, usage: event.usage }))
              break
            case "done":
              updateLast((m) => ({ ...m, status: "done" }))
              break
            case "error":
              updateLast((m) => ({ ...m, status: "error", error: event.message }))
              break
          }
        }

        // Stream closed without a terminal event (e.g. server crashed).
        updateLast((m) =>
          m.status === "streaming"
            ? { ...m, status: "error", error: "Connection closed unexpectedly." }
            : m
        )
      } catch (err) {
        if (controller.signal.aborted) {
          updateLast((m) => ({ ...m, status: "stopped" }))
        } else {
          const message = err instanceof Error ? err.message : "Request failed"
          updateLast((m) => ({ ...m, status: "error", error: message }))
        }
      } finally {
        abortRef.current = null
      }
    },
    [messages]
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { messages, isStreaming, send, stop }
}

/** Drop client-only fields (argsText can be kilobytes per widget). */
function toWirePart(part: ClientPart): Part {
  if (part.type !== "widget") return part
  const { argsText: _, ...wire } = part
  return wire
}

/** Append to the trailing text part, or start a new one. */
function appendText(message: ChatMessage, delta: string): ChatMessage {
  const parts = [...message.parts]
  const last = parts.at(-1)
  if (last?.type === "text") {
    parts[parts.length - 1] = { ...last, text: last.text + delta }
  } else {
    parts.push({ type: "text", text: delta })
  }
  return { ...message, parts }
}
