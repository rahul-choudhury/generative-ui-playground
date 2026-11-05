import { Card, Skeleton } from "@rahul-choudhury/ui/components"

/** Mirrors Choices: a question line, then option rows. */
export function ChoicesSkeleton() {
  return (
    <Card variant="bordered" className="max-w-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <Skeleton className="my-1 h-5 w-2/3" />
      </div>
      <div className="border-t border-border">
        {[40, 52, 36].map((width) => (
          <div key={width} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
