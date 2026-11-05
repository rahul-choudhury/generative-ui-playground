import { ArrowDownIcon } from "@phosphor-icons/react"
import { cn } from "@rahul-choudhury/ui"
import { Button } from "@rahul-choudhury/ui/components"
import { usePrefersReducedMotion } from "@rahul-choudhury/ui/hooks"
import { useEffect, useRef, useState } from "react"
import { Message } from "./message"
import type { ChatMessage } from "./use-chat"

/** Within this distance of the bottom, the list counts as "at the bottom". */
const PIN_THRESHOLD = 48
/** Scrolled further up than this, the jump-to-latest button appears. */
const JUMP_THRESHOLD = 160

/**
 * Scrollable list that follows new content while the user is at the bottom,
 * stops following once they scroll up to read, and offers a button back down.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastScrollTop = useRef(0)
  const [showJump, setShowJump] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  const distanceFromBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    // Only scrolling UP stops following. A smooth scroll back down passes
    // through "not at the bottom" on its way and must not unpin itself.
    if (el.scrollTop < lastScrollTop.current - 1) pinned.current = false
    if (distanceFromBottom(el) < PIN_THRESHOLD) pinned.current = true
    lastScrollTop.current = el.scrollTop
    setShowJump(distanceFromBottom(el) > JUMP_THRESHOLD)
  }

  // New content: follow it if pinned. If not, it may have just pushed the
  // bottom far enough away to need the button (no scroll event fires then).
  const lastUserMessageId = useRef<string | undefined>(undefined)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Sending a message always brings you back down to it, even if you were
    // scrolled up reading history.
    const latestUserId = messages.findLast((m) => m.role === "user")?.id
    if (latestUserId !== lastUserMessageId.current) {
      lastUserMessageId.current = latestUserId
      pinned.current = true
    }
    if (pinned.current) el.scrollTop = el.scrollHeight
    setShowJump(!pinned.current && distanceFromBottom(el) > JUMP_THRESHOLD)
  }, [messages])

  const jumpToLatest = () => {
    const el = scrollRef.current
    if (!el) return
    pinned.current = true // resume following, even if a reply is streaming
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" })
  }

  return (
    <div className="relative min-h-0 flex-1">
      {/* `relative` makes the scroller the containing block for absolutely
          positioned descendants (e.g. Tailwind's sr-only). Without it they're
          positioned against <body> at their unscrolled offset, which pushed
          the page taller than the window and gave it a second scrollbar. */}
      <div ref={scrollRef} onScroll={onScroll} className="relative h-full overflow-y-auto">
        <div className="mx-auto flex max-w-(--layout-container) flex-col gap-6 px-4 py-8">
          {messages.map((message, i) => (
            <Message key={message.id} message={message} isLatest={i === messages.length - 1} />
          ))}
        </div>
      </div>

      {/* Outside the scroller so it stays put while the list scrolls. Hidden
          rather than unmounted so it can fade out; `inert` keeps it out of
          the tab order and away from screen readers while hidden. */}
      <div
        inert={!showJump}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-3 flex justify-center",
          "transition-[opacity,translate] duration-(--duration-normal) ease-(--ease-out-quint) motion-reduce:transition-none",
          showJump ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          onClick={jumpToLatest}
          aria-label="Scroll to latest message"
          className="pointer-events-auto rounded-full shadow-md"
        >
          <ArrowDownIcon size={16} weight="bold" />
        </Button>
      </div>
    </div>
  )
}
