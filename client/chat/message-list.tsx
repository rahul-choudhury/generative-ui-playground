import { useEffect, useRef } from "react"
import { Message } from "./message"
import type { ChatMessage } from "./use-chat"

/**
 * Scrollable list that follows new content while the user is at the bottom,
 * and stops following once they scroll up to read.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    // `relative` makes this scroller the containing block for absolutely
    // positioned descendants (e.g. Tailwind's sr-only). Without it they're
    // positioned against <body> at their unscrolled offset, which pushed the
    // page taller than the window and gave it a second scrollbar.
    <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-(--layout-container) flex-col gap-6 px-4 py-8">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}
