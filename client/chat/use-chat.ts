import { useCallback, useRef, useState } from "react"
import type {
  Message,
  Part,
  StreamEvent,
  TextPart,
  Usage,
  WidgetPart,
  WidgetStatePart,
} from "../../shared/protocol"
import { getDefinition } from "../../widgets/definitions"
import { validateWidget } from "../../widgets/validate"
import { readNdjson } from "./read-ndjson"

/**
 * A widget part plus client-only fields, all stripped before history is sent:
 * - argsText: raw argument text so far (the pending view renders from it)
 * - state: current interactive state; undefined means "still initial"
 * - reportedState: the state as of the last message that reported it
 */
export type ClientWidgetPart = WidgetPart & {
  argsText?: string
  state?: unknown
  reportedState?: unknown
}
export type ClientPart = TextPart | ClientWidgetPart | WidgetStatePart

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

  /**
   * Send a user message. `widgetUpdate` applies a widget state change in the
   * same step (used by respond): set separately, React wouldn't have applied
   * it yet and the snapshot would miss it.
   */
  const send = useCallback(
    async (text: string, widgetUpdate?: { widgetId: string; state: unknown }) => {
      const content = text.trim()
      if (!content || abortRef.current) return

      const applyUpdate = (list: ChatMessage[]) =>
        widgetUpdate ? withWidgetState(list, widgetUpdate.widgetId, widgetUpdate.state) : list
      const current = applyUpdate(messages)

      // Widgets the user changed since their last message ride along as
      // snapshots; the server turns them into a note for the model.
      const snapshots = collectSnapshots(current)

      const user: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [...snapshots, { type: "text", text: content }],
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
      const history: Message[] = [...current, user]
        .filter((m) => m.status !== "error" && m.parts.length > 0)
        .map(({ id, role, parts }) => ({ id, role, parts: parts.map(toWirePart) }))

      // Mark what was just reported, so the next message only sends changes
      // made after this one.
      const reported = new Map(snapshots.map((s) => [s.widgetId, s.state]))
      setMessages((prev) => [
        ...applyUpdate(prev).map((m) => ({
          ...m,
          parts: m.parts.map((p) =>
            p.type === "widget" && reported.has(p.id) ? { ...p, reportedState: reported.get(p.id) } : p
          ),
        })),
        user,
        assistant,
      ])

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

  /** A silent change (e.g. a tick): reported with the next message. */
  const setWidgetState = useCallback((widgetId: string, state: unknown) => {
    setMessages((prev) => withWidgetState(prev, widgetId, state))
  }, [])

  /** An answer (e.g. picking an option): sent now, as the user's message. */
  const respond = useCallback(
    (widgetId: string, message: string, state?: unknown) =>
      send(message, state === undefined ? undefined : { widgetId, state }),
    [send]
  )

  return { messages, isStreaming, send, stop, setWidgetState, respond }
}

/** Set one widget's state. Widget ids are unique across the conversation. */
function withWidgetState(messages: ChatMessage[], widgetId: string, state: unknown): ChatMessage[] {
  return messages.map((m) =>
    m.parts.some((p) => p.type === "widget" && p.id === widgetId)
      ? { ...m, parts: m.parts.map((p) => (p.type === "widget" && p.id === widgetId ? { ...p, state } : p)) }
      : m
  )
}

/**
 * One snapshot per interactive widget whose state differs from what was last
 * reported (or from its initial state, if never reported). Ticking and then
 * unticking the same item cancels out, so no snapshot is sent.
 */
function collectSnapshots(messages: ChatMessage[]) {
  const snapshots: WidgetStatePart[] = []

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "widget" || part.state === undefined) continue
      const config = getDefinition(part.name)?.state
      const result = validateWidget(part.name, part.args)
      if (!config || result.status !== "ok") continue

      const before = part.reportedState ?? config.initial(result.data)
      if (JSON.stringify(before) === JSON.stringify(part.state)) continue

      snapshots.push({ type: "widget-state", widgetId: part.id, state: part.state })
    }
  }
  return snapshots
}

/** Drop client-only fields (argsText can be kilobytes per widget). */
function toWirePart(part: ClientPart): Part {
  switch (part.type) {
    case "widget": {
      const { argsText: _a, state: _s, reportedState: _r, ...wire } = part
      return wire
    }
    default:
      return part
  }
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
