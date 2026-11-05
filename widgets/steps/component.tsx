import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { StepsArgs } from "./definition"

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
      variant="bordered"
      className="max-w-xl px-5 pt-5 pb-2 sm:px-6"
      role="region"
      aria-label={title ?? "Timeline"}
      aria-busy={pending || undefined}
    >
      {title !== undefined ? (
        <h3 className="font-serif text-2xl leading-tight font-semibold">{title}</h3>
      ) : (
        <Skeleton className="h-7 w-48" />
      )}

      <ol className="mt-4">
        {steps.map((step, i) => (
          <li
            key={i}
            className={cn(
              "grid gap-x-4 pb-4",
              timed ? "grid-cols-[4.5rem_auto_1fr]" : "grid-cols-[1.5rem_auto_1fr]",
              pending && "motion-safe:animate-row-in"
            )}
          >
            <span className="pt-0.5 text-right text-xs leading-5 text-text-muted tabular-nums">
              {timed ? step.when : i + 1}
            </span>
            {/* The rail: a dot, and a line down to the next step. */}
            <span aria-hidden className="relative flex justify-center">
              <span className="mt-1.5 size-2 rounded-full border border-text-secondary bg-surface" />
              {i < steps.length - 1 && <span className="absolute top-4 -bottom-4 w-px bg-border" />}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-6 font-medium">{step.title}</p>
              {step.detail && <p className="mt-0.5 text-sm leading-6 text-text-muted">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function StepsSkeleton() {
  return (
    <Card variant="bordered" className="max-w-xl px-5 pt-5 pb-4 sm:px-6">
      <Skeleton className="h-7 w-48" />
      <div className="mt-5 flex flex-col gap-4">
        {[60, 72, 48].map((width) => (
          <div key={width} className="grid grid-cols-[1.5rem_auto_1fr] items-center gap-x-4">
            <Skeleton className="ml-auto h-3 w-3" />
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
