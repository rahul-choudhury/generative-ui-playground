import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react"
import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import { useId } from "react"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import type { ChoicesArgs, ChoicesState } from "./definition"

/**
 * A question with 2–4 answers. Picking one sends it straight away as the
 * user's message (and records the pick), so the model replies to it. Locks
 * once picked, while a reply streams, or once the conversation moves on.
 */
export function Choices({ args, state, respond, canRespond }: WidgetProps<ChoicesArgs, ChoicesState>) {
  return (
    <ChoicesLayout
      question={args.question}
      options={args.options.map((o) => ({ label: o.label, description: o.description ?? undefined }))}
      picked={state.picked}
      onPick={canRespond && state.picked === null ? (i) => respond(args.options[i]!.label, { picked: i }) : undefined}
    />
  )
}

/** While arguments stream: the question and options fill in, not clickable yet. */
export function ChoicesPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  return (
    <ChoicesLayout
      question={asString(args.question)}
      options={asArray(args.options)
        .map(asObject)
        .filter((o) => Boolean(asString(o.label)))
        .map((o) => ({ label: o.label as string, description: asString(o.description) }))}
      picked={null}
      pending={!interrupted}
    />
  )
}

type LayoutProps = {
  question: string | undefined
  options: { label: string; description?: string }[]
  picked: number | null
  /** Present only while the user can still pick. */
  onPick?: (index: number) => void
  pending?: boolean
}

function ChoicesLayout({ question, options, picked, onPick, pending = false }: LayoutProps) {
  const questionId = useId()
  const hasPick = picked !== null

  return (
    <Card
      variant="bordered"
      className="max-w-xl overflow-hidden"
      role="group"
      aria-labelledby={question !== undefined ? questionId : undefined}
      aria-busy={pending || undefined}
    >
      <div className="px-4 pt-4 pb-3">
        {question !== undefined ? (
          <p id={questionId} className="font-serif text-xl leading-snug text-balance">
            {question}
          </p>
        ) : (
          <Skeleton className="my-1 h-5 w-2/3" />
        )}
      </div>

      <ul className="border-t border-border">
        {options.map((option, i) => {
          const isPicked = picked === i
          return (
            <li
              key={i}
              className={cn("border-b border-border last:border-b-0", pending && "motion-safe:animate-row-in")}
            >
              <button
                type="button"
                disabled={!onPick}
                onClick={() => onPick?.(i)}
                aria-pressed={hasPick ? isPicked : undefined}
                className={cn(
                  "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--duration-fast)",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  "enabled:cursor-pointer enabled:hover:bg-surface-soft disabled:cursor-default",
                  isPicked && "bg-surface-soft",
                  hasPick && !isPicked && "text-text-muted"
                )}
              >
                <span className="mt-[3px] flex w-4 shrink-0 justify-center font-mono text-xs text-text-muted tabular-nums">
                  {isPicked ? <CheckIcon size={14} weight="bold" className="text-text" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-6 font-medium">{option.label}</span>
                  {option.description && (
                    <span className="block text-sm leading-5 text-text-muted">{option.description}</span>
                  )}
                </span>
                {/* Hover affordance, only while picking is possible. */}
                <ArrowRightIcon
                  size={16}
                  aria-hidden
                  className={cn(
                    "mt-1 shrink-0 text-text-muted opacity-0 transition-[opacity,translate] duration-(--duration-normal) ease-(--ease-out-quint)",
                    "-translate-x-1 group-enabled:group-hover:translate-x-0 group-enabled:group-hover:opacity-100",
                    "motion-reduce:translate-x-0 motion-reduce:transition-none"
                  )}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
