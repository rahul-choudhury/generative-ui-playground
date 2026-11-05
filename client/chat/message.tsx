import { cn } from "@rahul-choudhury/ui"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Part } from "../../shared/protocol"
import type { ChatMessage } from "./use-chat"

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-surface-soft px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap break-words">
          {message.parts.map((part) => (part.type === "text" ? part.text : null))}
        </div>
      </div>
    )
  }

  const isEmpty = message.parts.length === 0

  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => (
        <PartView key={i} part={part} />
      ))}

      {message.status === "streaming" && isEmpty && <TypingIndicator />}

      {message.status === "stopped" && (
        <p className="text-sm text-text-muted">Stopped.</p>
      )}

      {message.status === "error" && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {message.error ?? "Something went wrong."}
        </p>
      )}
    </div>
  )
}

/** One branch per part type. Step 2 adds the widget branch here. */
function PartView({ part }: { part: Part }) {
  switch (part.type) {
    case "text":
      return (
        <div className="markdown">
          <Markdown remarkPlugins={[remarkGfm]}>{part.text}</Markdown>
        </div>
      )
  }
}

function TypingIndicator() {
  return (
    <div className="flex h-7 items-center gap-1" aria-label="Assistant is responding">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={cn("size-1.5 animate-pulse rounded-full bg-text-muted")}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
