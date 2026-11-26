import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import { useId } from "react"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import styles from "./choices.module.css"
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
      className={styles.card}
      data-pending={pending || undefined}
      role="group"
      aria-labelledby={question !== undefined ? questionId : undefined}
      aria-busy={pending || undefined}
    >
      <div className={styles.head}>
        {question !== undefined ? (
          <p id={questionId} className={styles.question}>
            {question}
          </p>
        ) : (
          <Skeleton className={styles.questionSkeleton} />
        )}
      </div>

      <ul className={styles.options}>
        {options.map((option, i) => {
          const isPicked = picked === i
          return (
            <li key={i} className={styles.option}>
              <button
                type="button"
                disabled={!onPick}
                onClick={() => onPick?.(i)}
                aria-pressed={hasPick ? isPicked : undefined}
                className={styles.button}
              >
                <span className={styles.number}>
                  {isPicked ? <CheckIcon size={14} weight="bold" className={styles.check} aria-hidden /> : i + 1}
                </span>
                <span className={styles.text}>
                  <span className={styles.label}>{option.label}</span>
                  {option.description && <span className={styles.description}>{option.description}</span>}
                </span>
                <ArrowRightIcon size={16} aria-hidden className={styles.arrow} />
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
