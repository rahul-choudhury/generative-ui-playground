import { useCallback, useRef, useState } from "react"
import type { Message, StreamEvent, Usage } from "../../shared/protocol"
import { readNdjson } from "./read-ndjson"

/** Client-only fields on top of the wire Message. Never sent to the server. */
export type ChatMessage = Message & {
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
        .map(({ id, role, parts }) => ({ id, role, parts }))

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
