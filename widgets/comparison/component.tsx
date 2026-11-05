import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { ComparisonArgs } from "./definition"

/**
 * A side-by-side table in the fact card's language: subjects as serif column
 * heads, attributes down a muted first column, and a small mark on the value
 * that wins its row. The verdict closes it like a footnote.
 */
export function Comparison({ args }: WidgetProps<ComparisonArgs, undefined>) {
  return <ComparisonLayout {...args} />
}

/** While streaming: columns, then rows, fill in. */
export function ComparisonPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  return (
    <ComparisonLayout
      title={asString(args.title) ?? null}
      subjects={asArray(args.subjects).flatMap((s) => (asString(s) ? [s as string] : []))}
      rows={asArray(args.rows)
        .map(asObject)
        .filter((row) => Boolean(asString(row.label)))
        .map((row) => ({
          label: row.label as string,
          values: asArray(row.values).map((v) => asString(v) ?? ""),
          best: typeof row.best === "number" ? row.best : null,
        }))}
      verdict={asString(args.verdict) ?? null}
      pending={!interrupted}
    />
  )
}

type LayoutProps = ComparisonArgs & { pending?: boolean }

function ComparisonLayout({ title, subjects, rows, verdict, pending = false }: LayoutProps) {
  const enter = cn(pending && "motion-safe:animate-row-in")

  return (
    <Card
      variant="bordered"
      className="overflow-hidden"
      role="region"
      aria-label={subjects.length ? `Comparison of ${subjects.join(", ")}` : "Comparison"}
      aria-busy={pending || undefined}
    >
      {title && <p className="px-5 pt-4 text-sm text-text-muted sm:px-6">{title}</p>}

      {/* Wide tables scroll sideways in narrow chats; the attribute column
          stays pinned so each row keeps its label. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface" aria-label="Attribute" />
              {subjects.length > 0
                ? subjects.map((subject, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="min-w-32 px-4 pt-4 pb-3 text-left align-bottom font-serif text-xl leading-tight font-semibold"
                    >
                      {subject}
                    </th>
                  ))
                : [0, 1].map((i) => (
                    <th key={i} className="px-4 pt-4 pb-3">
                      <Skeleton className="h-5 w-24" />
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={cn("border-t border-border", enter)}>
                <th
                  scope="row"
                  className="sticky left-0 bg-surface py-2.5 pr-3 pl-5 text-left align-top font-normal whitespace-nowrap text-text-muted sm:pl-6"
                >
                  {row.label}
                </th>
                {subjects.map((_, i) => {
                  const isBest = row.best === i
                  return (
                    <td key={i} className={cn("px-4 py-2.5 align-top", isBest && "font-medium")}>
                      {row.values[i]}
                      {isBest && (
                        <>
                          {/* A quiet mark rather than a colour: readable in
                              both themes and to screen readers. */}
                          <span aria-hidden className="ml-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-text align-middle" />
                          <span className="sr-only"> (better)</span>
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {verdict && (
        <p className={cn("border-t border-border px-5 py-3.5 font-serif text-[1.05rem] leading-snug sm:px-6", enter)}>
          {verdict}
        </p>
      )}
    </Card>
  )
}

export function ComparisonSkeleton() {
  return (
    <Card variant="bordered" className="overflow-hidden">
      <div className="flex gap-8 px-5 pt-4 pb-3 sm:px-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-24" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-8 border-t border-border px-5 py-3 sm:px-6">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      ))}
    </Card>
  )
}
