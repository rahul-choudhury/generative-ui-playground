import { Card, Skeleton } from "@rahul-choudhury/ui/components"

/** Mirrors FactCard: name + descriptor, headline figure, leader rows. */
export function FactCardSkeleton() {
  return (
    <Card variant="bordered" className="max-w-[36rem] px-5 pt-5 pb-4 sm:px-6">
      <div className="flex items-end justify-between gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </Card>
  )
}
