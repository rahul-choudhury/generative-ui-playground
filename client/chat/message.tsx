import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import type { ChatMessage, ClientPart } from "./use-chat"
import { WidgetView } from "./widget-view"
import styles from "./message.module.css"

/** `isLatest`: the last message in the conversation (widgets in older ones lock). */
export function Message({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  if (message.role === "user") {
    // Only the text is shown. Widget-state parts on this message are sent to
    // the model (as a note the server writes) but deliberately not displayed.
    return (
      <div className={styles.userRow}>
        <div className={styles.bubble}>
          {message.parts.map((part) => (part.type === "text" ? part.text : null))}
        </div>
      </div>
    )
  }

  const isEmpty = message.parts.length === 0

  return (
    <div className={styles.assistant}>
      {message.parts.map((part, i) => (
        <PartView
          key={part.type === "widget" ? part.id : i}
          part={part}
          isStreaming={message.status === "streaming"}
          isLatest={isLatest}
        />
      ))}

      {message.status === "streaming" && isEmpty && <TypingIndicator />}

      {message.status === "stopped" && (
        <p className={styles.stopped}>Stopped.</p>
      )}

      {message.status === "error" && (
        <p className={styles.error}>
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
function PartView(props: { part: ClientPart; isStreaming: boolean; isLatest: boolean }) {
  const { part, isStreaming, isLatest } = props
  switch (part.type) {
    case "widget":
      return <WidgetView part={part} isStreaming={isStreaming} isLatest={isLatest} />
    case "text":
      return (
        <div className="markdown">
          <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {part.text}
          </Markdown>
        </div>
      )
    case "widget-state":
      return null // sent to the model, never displayed
  }
}

function TypingIndicator() {
  return (
    <div className={styles.typing} aria-label="Assistant is responding">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={styles.dot}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
