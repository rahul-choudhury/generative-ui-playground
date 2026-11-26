import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import { Button, Textarea } from "@rahul-choudhury/ui/components"
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react"
import styles from "./composer.module.css"

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

  // Called from the form's onSubmit and from Enter in onKeyDown, so it takes
  // the shared base type. preventDefault stops the page reload / the newline.
  const submit = (e?: SyntheticEvent) => {
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
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.box}>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message…"
          aria-label="Message"
          rows={1}
          autoFocus
          variant="bare"
          className={styles.textarea}
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
