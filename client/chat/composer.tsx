import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import { Button, Textarea } from "@rahul-choudhury/ui/components"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

type ComposerProps = {
  isStreaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function Composer({ isStreaming, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState("")
  const canSend = text.trim().length > 0 && !isStreaming
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When a response ends (finished or stopped), put the cursor back in the
  // textarea. Otherwise clicking Stop leaves focus on a button that then
  // swaps to Send, and typing goes nowhere.
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus()
  }, [isStreaming])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(text)
    setText("")
  }

  // Enter sends, Shift+Enter inserts a newline. Ignore Enter while an IME
  // composition is active (e.g. typing Japanese).
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-(--layout-container) px-4 pb-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm focus-within:border-border-strong">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message…"
          aria-label="Message"
          rows={1}
          autoFocus
          className="max-h-48 resize-none border-0 bg-transparent field-sizing-content focus-visible:ring-0"
        />
        {isStreaming ? (
          <Button type="button" variant="secondary" size="icon" onClick={onStop} aria-label="Stop">
            <StopIcon weight="fill" size={14} />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!canSend} aria-label="Send">
            <ArrowUpIcon weight="bold" size={16} />
          </Button>
        )}
      </div>
    </form>
  )
}
