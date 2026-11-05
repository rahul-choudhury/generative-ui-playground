import { Card, Skeleton } from "@rahul-choudhury/ui/components"

/** Shown while the checklist's arguments stream. Mirrors the real layout. */
export function ChecklistSkeleton() {
  return (
    <Card variant="bordered" className="overflow-hidden">
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
