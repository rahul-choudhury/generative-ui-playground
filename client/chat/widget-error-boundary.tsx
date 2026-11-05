import { Component, type ReactNode } from "react"

type Props = {
  children: ReactNode
  /** Rendered instead of the children once they throw. */
  fallback: (error: Error) => ReactNode
}

/**
 * Contains a crash to the one widget that threw. Without it, an exception in
 * any widget's render unmounts the whole chat. Error boundaries still have to
 * be class components in React 19.
 */
export class WidgetErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown) {
    console.error("[widget] render crashed", error)
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children
  }
}
