import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import styles from "./comparison.module.css"
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
  return (
    <Card
      className={styles.card}
      data-pending={pending || undefined}
      role="region"
      aria-label={subjects.length ? `Comparison of ${subjects.join(", ")}` : "Comparison"}
      aria-busy={pending || undefined}
    >
      {title && <p className={styles.title}>{title}</p>}

      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner} aria-label="Attribute" />
              {subjects.length > 0
                ? subjects.map((subject, i) => (
                    <th key={i} scope="col" className={styles.subject}>
                      {subject}
                    </th>
                  ))
                : [0, 1].map((i) => (
                    <th key={i} className={styles.subjectSkeletonCell}>
                      <Skeleton className={styles.subjectSkeleton} />
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={`${styles.row} ${styles.enter}`}>
                <th scope="row" className={styles.attribute}>
                  {row.label}
                </th>
                {subjects.map((_, i) => {
                  const isBest = row.best === i
                  return (
                    <td key={i} className={styles.value} data-best={isBest || undefined}>
                      {row.values[i]}
                      {isBest && (
                        <>
                          <span aria-hidden className={styles.mark} />
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

      {verdict && <p className={`${styles.verdict} ${styles.enter}`}>{verdict}</p>}
    </Card>
  )
}

export function ComparisonSkeleton() {
  return (
    <Card className={styles.card}>
      <div className={styles.skeletonHead}>
        <Skeleton className={styles.skeletonLabel} />
        <Skeleton className={styles.subjectSkeleton} />
        <Skeleton className={styles.subjectSkeleton} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonRow}>
          <Skeleton className={styles.skeletonAttribute} />
          <Skeleton className={styles.skeletonValue} />
          <Skeleton className={styles.skeletonValue} />
        </div>
      ))}
    </Card>
  )
}
