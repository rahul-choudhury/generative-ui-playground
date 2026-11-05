import { cn } from "@rahul-choudhury/ui"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import type { Part } from "../../shared/protocol"
import type { ChatMessage } from "./use-chat"
import { WidgetView } from "./widget-view"

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-surface-soft px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap wrap-break-word">
          {message.parts.map((part) => (part.type === "text" ? part.text : null))}
        </div>
      </div>
    )
  }

  const isEmpty = message.parts.length === 0

  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => (
        <PartView
          key={part.type === "widget" ? part.id : i}
          part={part}
          isStreaming={message.status === "streaming"}
        />
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

// Module-level so they aren't recreated on every streamed delta.
// rehype-highlight only highlights fenced blocks with a language tag (no
// auto-detect), using highlight.js's ~35 common languages.
const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeHighlight]

/** One branch per part type. */
function PartView({ part, isStreaming }: { part: Part; isStreaming: boolean }) {
  switch (part.type) {
    case "widget":
      return <WidgetView part={part} isStreaming={isStreaming} />
    case "text":
      return (
        <div className="markdown">
          <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {part.text}
          </Markdown>
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
