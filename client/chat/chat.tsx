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

export function Chat() {
  const { models, selected, select } = useModels()
  const { messages, isStreaming, send, stop, setWidgetState, respond } = useChat(selected)
  const widgetActions = useMemo(
    () => ({ setWidgetState, respond, isStreaming }),
    [setWidgetState, respond, isStreaming]
  )

  return (
    <WidgetActionsContext value={widgetActions}>
      <main className="flex h-full flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <EmptyState
              icon={<ChatsCircleIcon size={32} />}
              title="Generative UI playground"
              description="Ask anything. Try a packing list, or “tell me about Tokyo”."
            />
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        {/* Model on the left, context and cost on the right. */}
        <div className="mx-auto flex w-full max-w-(--layout-container) items-center gap-3 px-4 pb-1.5">
          <ModelSelect models={models} selected={selected} onSelect={select} />
          <UsageBar messages={messages} />
        </div>
        <Composer isStreaming={isStreaming} onSend={send} onStop={stop} />
      </main>
    </WidgetActionsContext>
  )
}
