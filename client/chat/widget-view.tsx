import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import { useMemo } from "react"
import { parsePartialJson } from "../../shared/partial-json"
import { getComponents } from "../../widgets/components"
import { getDefinition } from "../../widgets/definitions"
import { validateWidget } from "../../widgets/validate"
import type { ClientWidgetPart } from "./use-chat"
import { WidgetErrorBoundary } from "./widget-error-boundary"
import { WidgetFallback, WidgetInterrupted } from "./widget-fallback"

/**
 * Renders any registered widget part through its lifecycle:
 *
 *   no arguments yet       → Skeleton
 *   arguments streaming    → Pending view, filling in as they arrive
 *   arguments complete     → validated, then the finished Component
 *   stopped mid-arguments  → the Pending view frozen, plus a note
 *
 * Knows no widget by name: everything comes from the registries.
 */
export function WidgetView({ part, isStreaming }: { part: ClientWidgetPart; isStreaming: boolean }) {
  // Re-parsed on each delta. Argument text is a few KB at most, so a full
  // parse per delta is cheaper than keeping incremental parser state.
  const partial = useMemo(
    () => (part.argsText ? parsePartialJson(part.argsText) : undefined),
    [part.argsText]
  )

  const definition = getDefinition(part.name)
  const entry = getComponents(part.name)

  if (!definition || !entry) {
    return <WidgetFallback kind="unknown" name={part.name} args={part.args} />
  }

  if (part.args === undefined) {
    const hasContent =
      partial !== null && typeof partial === "object" && Object.keys(partial).length > 0
    const pendingView =
      entry.Pending && hasContent ? (
        // A pending view reads untrusted partial data; contain any crash.
        <WidgetErrorBoundary fallback={() => null}>
          <entry.Pending partial={partial} interrupted={!isStreaming} />
        </WidgetErrorBoundary>
      ) : null

    // Stopped (or the stream failed) before the arguments finished.
    if (!isStreaming) {
      return (
        <div className="flex flex-col gap-2">
          {pendingView}
          <WidgetInterrupted label={definition.label} partial={pendingView !== null} />
        </div>
      )
    }

    if (pendingView) return pendingView
    const Placeholder = entry.Skeleton ?? GenericSkeleton
    return (
      <div aria-busy="true" aria-label={`Preparing ${definition.label}`}>
        <Placeholder />
      </div>
    )
  }

  // The model's arguments are untrusted input: check them before rendering.
  const result = validateWidget(part.name, part.args)
  if (result.status !== "ok") {
    // "unknown" was handled above; the registries and validator share one list.
    const issues = result.status === "invalid" ? result.issues : []
    return <WidgetFallback kind="invalid" label={definition.label} issues={issues} args={part.args} />
  }

  return (
    <WidgetErrorBoundary
      fallback={(error) => (
        <WidgetFallback kind="crashed" label={definition.label} error={error} args={part.args} />
      )}
    >
      <entry.Component {...result.data} />
    </WidgetErrorBoundary>
  )
}

function GenericSkeleton() {
  return (
    <Card variant="bordered" className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-3.5 w-1/2" />
    </Card>
  )
}
