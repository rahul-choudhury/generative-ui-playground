import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetPart } from "../../shared/protocol"
import { getComponents } from "../../widgets/components"
import { getDefinition } from "../../widgets/definitions"

/**
 * Renders any registered widget part. Knows no widget by name: everything
 * comes from the registries. Step 4 replaces the one-line notes with proper
 * fallbacks.
 */
export function WidgetView({ part, isStreaming }: { part: WidgetPart; isStreaming: boolean }) {
  const definition = getDefinition(part.name)
  const entry = getComponents(part.name)

  if (!definition || !entry) {
    return <WidgetNote>The assistant tried to show an unknown widget “{part.name}”.</WidgetNote>
  }

  // Arguments haven't finished streaming yet.
  if (part.args === undefined) {
    if (!isStreaming) {
      return <WidgetNote>The {definition.label} was interrupted before it finished.</WidgetNote>
    }
    const Placeholder = entry.Skeleton ?? GenericSkeleton
    return (
      <div aria-busy="true" aria-label={`Preparing ${definition.label}`}>
        <Placeholder />
      </div>
    )
  }

  // The model's arguments are untrusted input: check them before rendering.
  const parsed = definition.schema.safeParse(part.args)
  if (!parsed.success) {
    console.warn(`[widget] invalid ${part.name} args`, parsed.error.issues, part.args)
    return <WidgetNote>The {definition.label} couldn’t be displayed (invalid data).</WidgetNote>
  }

  return <entry.Component {...parsed.data} />
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

function WidgetNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-border px-3 py-2 text-sm text-text-muted">{children}</p>
  )
}
