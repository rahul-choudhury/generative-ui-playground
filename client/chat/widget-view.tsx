import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetPart } from "../../shared/protocol"
import { getComponents } from "../../widgets/components"
import { getDefinition } from "../../widgets/definitions"
import { validateWidget } from "../../widgets/validate"
import { WidgetErrorBoundary } from "./widget-error-boundary"
import { WidgetFallback, WidgetInterrupted } from "./widget-fallback"

/**
 * Renders any registered widget part, or the right fallback. Knows no widget
 * by name: everything comes from the registries. Validation is the same
 * function the server uses to tell the model what happened.
 */
export function WidgetView({ part, isStreaming }: { part: WidgetPart; isStreaming: boolean }) {
  const definition = getDefinition(part.name)
  const entry = getComponents(part.name)

  if (!definition || !entry) {
    return <WidgetFallback kind="unknown" name={part.name} args={part.args} />
  }

  // Arguments haven't finished streaming yet.
  if (part.args === undefined) {
    if (!isStreaming) return <WidgetInterrupted label={definition.label} />
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
