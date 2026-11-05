import { createContext, useContext } from "react"

/**
 * Lets a widget deep in the message tree report a state change (e.g. a tick)
 * to useChat without passing a callback through every component in between.
 */
export const WidgetStateContext = createContext<(widgetId: string, state: unknown) => void>(() => {
  throw new Error("WidgetStateContext is missing a provider")
})

export const useSetWidgetState = () => useContext(WidgetStateContext)
