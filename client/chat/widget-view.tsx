import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetPart } from "../../shared/protocol"
import { Checklist } from "../../widgets/checklist/component"
import { checklist } from "../../widgets/checklist/definition"

/**
 * Turns a widget part into a component. Hand-wired to the one widget we have;
 * step 3 replaces the `if` with a registry lookup, and step 4 replaces the
 * one-line errors with proper fallbacks.
 */
export function WidgetView({ part, isStreaming }: { part: WidgetPart; isStreaming: boolean }) {
  if (part.name !== checklist.name) {
    return <WidgetNote>The assistant tried to show an unknown widget “{part.name}”.</WidgetNote>
  }

  // Arguments haven't finished streaming yet.
  if (part.args === undefined) {
    return isStreaming ? (
      <ChecklistSkeleton />
    ) : (
      <WidgetNote>The checklist was interrupted before it finished.</WidgetNote>
    )
  }

  // The model's arguments are untrusted input: check them before rendering.
  const parsed = checklist.schema.safeParse(part.args)
  if (!parsed.success) {
    console.warn("[widget] invalid checklist args", parsed.error.issues, part.args)
    return <WidgetNote>The checklist couldn’t be displayed (invalid data).</WidgetNote>
  }

  return <Checklist {...parsed.data} />
}

function ChecklistSkeleton() {
  return (
    <Card variant="bordered" className="overflow-hidden" aria-busy="true" aria-label="Preparing checklist">
      <div className="border-b border-border px-4 py-3.5">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        {[72, 56, 64].map((width) => (
          <div key={width} className="flex items-center gap-3">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function WidgetNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-border px-3 py-2 text-sm text-text-muted">{children}</p>
  )
}
