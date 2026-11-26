import { ChatsCircleIcon } from "@phosphor-icons/react"
import { EmptyState } from "@rahul-choudhury/ui/components"
import { useMemo } from "react"
import { Composer } from "./composer"
import { MessageList } from "./message-list"
import { ModelSelect } from "./model-select"
import { UsageBar } from "./usage-bar"
import { useChat } from "./use-chat"
import { useModels } from "./use-models"
import { WidgetActionsContext } from "./widget-actions-context"
import styles from "./chat.module.css"

export function Chat() {
  const { models, selected, select } = useModels()
  const { messages, isStreaming, send, stop, setWidgetState, respond } = useChat(selected)
  const widgetActions = useMemo(
    () => ({ setWidgetState, respond, isStreaming }),
    [setWidgetState, respond, isStreaming]
  )

  return (
    <WidgetActionsContext value={widgetActions}>
      <main className={styles.main}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              icon={<ChatsCircleIcon size={32} />}
              title="Generative UI playground"
              description="Ask anything. Try a packing list, or “tell me about Tokyo”."
            />
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div className={styles.bar}>
          <ModelSelect models={models} selected={selected} onSelect={select} />
          <UsageBar messages={messages} />
        </div>
        <Composer isStreaming={isStreaming} onSend={send} onStop={stop} />
      </main>
    </WidgetActionsContext>
  )
}
