import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { FactCardArgs } from "./definition"

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
  // Rows only animate while pending; the finished card mounts without it.
  const enter = cn(pending && "motion-safe:animate-row-in")

  return (
    <Card
      variant="bordered"
      // Narrower than the chat column: an entry, not a table. Keeps the
      // dotted leaders short enough to guide the eye.
      // @container: fact rows adapt to the card's width, not the viewport's.
      className="@container max-w-xl px-5 pt-5 pb-4 sm:px-6"
      role="region"
      aria-label={subject ? `Facts about ${subject}` : "Fact card"}
      aria-busy={(pending && !interrupted) || undefined}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {subject !== undefined ? (
            <h3 className="font-serif text-[2rem] leading-tight font-semibold text-balance">{subject}</h3>
          ) : (
            <Skeleton className="my-1.5 h-7 w-36" />
          )}
          {descriptor !== undefined && (
            <p className="font-serif text-lg leading-snug text-text-muted italic">{descriptor}</p>
          )}
        </div>

        {headline && (
          <div className={cn("@sm:text-right", enter)}>
            {/* The serif's digits are lining by default. Proportional (not
                tabular) spacing: tnum spreads "14.18M" apart at this size. */}
            <p className="font-serif text-[2.25rem] leading-none">{headline.value}</p>
            {headline.label !== undefined && (
              <p className="mt-1.5 text-xs text-text-muted">{headline.label}</p>
            )}
          </div>
        )}
      </header>

      <dl className="mt-5 border-t border-border pt-3 text-sm">
        {facts.map((fact, i) => (
          // Narrow card: label above value, no leader. From @sm (24rem) up:
          // one line, label …… value. Leaders need room to read as leaders.
          <div
            key={i}
            className={cn(
              "flex flex-col py-1.5 @sm:flex-row @sm:items-baseline @sm:gap-2 @sm:py-1.25",
              enter
            )}
          >
            {/* The leader is the dt's ::after, so the markup stays a valid
                dt/dd pair and screen readers never see it. Labels don't wrap,
                so the leader always sits on the label's line. */}
            <dt className="text-xs text-text-muted @sm:flex @sm:flex-1 @sm:items-baseline @sm:gap-2 @sm:text-sm @sm:whitespace-nowrap @sm:text-text-secondary @sm:after:min-w-6 @sm:after:flex-1 @sm:after:translate-y-[-0.3em] @sm:after:border-b @sm:after:border-dotted @sm:after:border-border-strong @sm:after:content-['']">
              {fact.label}
            </dt>
            <dd className="font-medium tabular-nums @sm:max-w-[60%] @sm:text-right">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {asOf && (
        <p className={cn("mt-3 font-serif text-sm text-text-muted italic", enter)}>
          Figures as of {asOf}.
        </p>
      )}
    </Card>
  )
}
