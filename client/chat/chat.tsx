import { ChatsCircleIcon } from "@phosphor-icons/react"
import { EmptyState } from "@rahul-choudhury/ui/components"
import { Composer } from "./composer"
import { MessageList } from "./message-list"
import { UsageBar } from "./usage-bar"
import { useChat } from "./use-chat"
import { WidgetStateContext } from "./widget-state-context"

export function Chat() {
  const { messages, isStreaming, send, stop, setWidgetState } = useChat()

  return (
    <WidgetStateContext value={setWidgetState}>
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
        <UsageBar messages={messages} />
        <Composer isStreaming={isStreaming} onSend={send} onStop={stop} />
      </main>
    </WidgetStateContext>
  )
}
