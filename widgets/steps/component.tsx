import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { StepsArgs } from "./definition"
import styles from "./steps.module.css"

/**
 * A sequence on a vertical rail. Each marker is the step's "when" (Day 1,
 * 9:00, 1969) or, without one, its number, set small and tabular beside a
 * dot, so the rail reads like a printed itinerary or an index of dates.
 */
export function Steps({ args }: WidgetProps<StepsArgs, undefined>) {
  return <StepsLayout {...args} />
}

export function StepsPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  return (
    <StepsLayout
      title={asString(args.title)}
      steps={asArray(args.steps)
        .map(asObject)
        .filter((step) => Boolean(asString(step.title)))
        .map((step) => ({
          when: asString(step.when) ?? null,
          title: step.title as string,
          detail: asString(step.detail) ?? null,
        }))}
      pending={!interrupted}
    />
  )
}

type LayoutProps = { title: string | undefined; steps: StepsArgs["steps"]; pending?: boolean }

function StepsLayout({ title, steps, pending = false }: LayoutProps) {
  const timed = steps.some((step) => step.when)

  return (
    <Card
      className={styles.card}
      data-pending={pending || undefined}
      role="region"
      aria-label={title ?? "Timeline"}
      aria-busy={pending || undefined}
    >
      {title !== undefined ? (
        <h3 className={styles.title}>{title}</h3>
      ) : (
        <Skeleton className={styles.titleSkeleton} />
      )}

      <ol className={styles.list} data-timed={timed || undefined}>
        {steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.marker}>{timed ? step.when : i + 1}</span>
            <span aria-hidden className={styles.rail}>
              <span className={styles.dot} />
              {i < steps.length - 1 && <span className={styles.line} />}
            </span>
            <div className={styles.body}>
              <p className={styles.stepTitle}>{step.title}</p>
              {step.detail && <p className={styles.detail}>{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function StepsSkeleton() {
  return (
    <Card className={`${styles.card} ${styles.skeletonCard}`}>
      <Skeleton className={styles.titleSkeleton} />
      <div className={styles.skeletonRows}>
        {[60, 72, 48].map((width) => (
          <div key={width} className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonMarker} />
            <Skeleton className={styles.skeletonDot} />
            <Skeleton className={styles.skeletonLine} style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
