import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { FactCardArgs } from "./definition"
import styles from "./fact-card.module.css"

/**
 * An almanac entry rather than a dashboard tile: serif name with an italic
 * descriptor, one headline figure set large, and facts joined to their values
 * by dotted leaders, like an index or a reference book's table. Read-only:
 * it has no state.
 */
export function FactCard({ args }: WidgetProps<FactCardArgs, undefined>) {
  const { subject, descriptor, headline, facts, asOf } = args
  return (
    <FactCardLayout
      subject={subject}
      descriptor={descriptor}
      headline={headline ?? undefined}
      facts={facts}
      asOf={asOf ?? undefined}
    />
  )
}

/**
 * The card while its arguments stream: name, headline and fact rows fill in
 * as they arrive. Same layout as the finished card, so nothing moves when the
 * final arguments land.
 */
export function FactCardPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  const headline = asObject(args.headline)
  const headlineValue = asString(headline.value)

  return (
    <FactCardLayout
      subject={asString(args.subject)}
      descriptor={asString(args.descriptor)}
      headline={
        headlineValue !== undefined ? { value: headlineValue, label: asString(headline.label) } : undefined
      }
      // A row appears once its label has a character (no empty-row flash).
      facts={asArray(args.facts)
        .map(asObject)
        .filter((fact) => Boolean(asString(fact.label)))
        .map((fact) => ({ label: fact.label as string, value: asString(fact.value) }))}
      asOf={asString(args.asOf)}
      pending
      interrupted={interrupted}
    />
  )
}

type LayoutProps = {
  subject: string | undefined
  descriptor: string | undefined
  headline: { value: string; label?: string } | undefined
  facts: { label: string; value?: string }[]
  asOf: string | undefined
  pending?: boolean
  /** Stopped before finishing: still partial, but no longer loading. */
  interrupted?: boolean
}

function FactCardLayout({ subject, descriptor, headline, facts, asOf, pending = false, interrupted = false }: LayoutProps) {
  return (
    <Card
      className={styles.card}
      data-pending={pending || undefined}
      role="region"
      aria-label={subject ? `Facts about ${subject}` : "Fact card"}
      aria-busy={(pending && !interrupted) || undefined}
    >
      <header className={styles.header}>
        <div className={styles.name}>
          {subject !== undefined ? (
            <h3 className={styles.subject}>{subject}</h3>
          ) : (
            <Skeleton className={styles.subjectSkeleton} />
          )}
          {descriptor !== undefined && <p className={styles.descriptor}>{descriptor}</p>}
        </div>

        {headline && (
          <div className={`${styles.headline} ${styles.enter}`}>
            <p className={styles.headlineValue}>{headline.value}</p>
            {headline.label !== undefined && <p className={styles.headlineLabel}>{headline.label}</p>}
          </div>
        )}
      </header>

      <dl className={styles.facts}>
        {facts.map((fact, i) => (
          <div key={i} className={`${styles.fact} ${styles.enter}`}>
            <dt className={styles.label}>{fact.label}</dt>
            <dd className={styles.value}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {asOf && <p className={`${styles.asOf} ${styles.enter}`}>Figures as of {asOf}.</p>}
    </Card>
  )
}
