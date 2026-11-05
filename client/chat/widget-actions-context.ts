import { createContext, useContext } from "react"

/**
 * What widgets deep in the message tree can do to the conversation, without
 * passing callbacks through every component in between.
 */
export type WidgetActions = {
  /** Silent change, reported with the user's next message (e.g. a tick). */
  setWidgetState: (widgetId: string, state: unknown) => void
  /** Send a message as the user now, optionally with a new state (e.g. a pick). */
  respond: (widgetId: string, message: string, state?: unknown) => void
  isStreaming: boolean
}

export const WidgetActionsContext = createContext<WidgetActions | null>(null)

export function useWidgetActions() {
  const actions = useContext(WidgetActionsContext)
  if (!actions) throw new Error("WidgetActionsContext is missing a provider")
  return actions
}
