import { Card, Checkbox, Skeleton } from "@rahul-choudhury/ui/components"
import Markdown from "react-markdown"
import type { WidgetProps } from "../define"
import { asArray, asObject, asString } from "../partial"
import styles from "./checklist.module.css"
import type { ChecklistArgs, ChecklistState } from "./definition"

/**
 * The finished checklist. Ticks live in the chat (not local state), so they
 * survive re-renders and reach the model with the user's next message.
 */
export function Checklist({ args, state, setState }: WidgetProps<ChecklistArgs, ChecklistState>) {
  const toggle = (index: number, value: boolean) =>
    setState(state.map((c, i) => (i === index ? value : c)))

  return (
    <ChecklistLayout
      title={args.title}
      labels={args.items.map((i) => i.label)}
      checked={state}
      onToggle={toggle}
    />
  )
}

/**
 * The checklist while its arguments stream: items appear as they arrive and
 * the one being written fills in. Same layout as the finished one, so nothing
 * moves when the final arguments land. Not interactive until then.
 */
export function ChecklistPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  // A row appears once its label has a character: `{"label":"` alone would
  // flash an empty row (and a 4px height change) for a few milliseconds.
  const items = asArray(args.items)
    .map(asObject)
    .filter((item) => Boolean(asString(item.label)))

  return (
    <ChecklistLayout
      title={asString(args.title)}
      labels={items.map((item) => item.label as string)}
      checked={items.map((item) => item.checked === true)}
      pending
      interrupted={interrupted}
    />
  )
}

type LayoutProps = {
  title: string | undefined
  labels: string[]
  checked: boolean[]
  onToggle?: (index: number, value: boolean) => void
  pending?: boolean
  /** Stopped before finishing: still partial, but no longer loading. */
  interrupted?: boolean
}

function ChecklistLayout({ title, labels, checked, onToggle, pending = false, interrupted = false }: LayoutProps) {
  const done = checked.filter(Boolean).length

  return (
    <Card
      className={styles.card}
      data-pending={pending || undefined}
      role="region"
      aria-label={title ?? "Checklist"}
      aria-busy={(pending && !interrupted) || undefined}
    >
      <div className={styles.header}>
        {title !== undefined ? (
          <h3 className={styles.title}>{title}</h3>
        ) : (
          <Skeleton className={styles.titleSkeleton} />
        )}
        <span className={styles.count}>
          {done}/{labels.length}
        </span>
      </div>

      <ul className={styles.list}>
        {labels.map((label, i) => (
          <li key={i} className={styles.row}>
            <label className={styles.item}>
              <Checkbox
                checked={checked[i]}
                disabled={pending}
                onCheckedChange={(value) => onToggle?.(i, value)}
                className={styles.checkbox}
              />
              <span className={styles.label} data-checked={checked[i] || undefined}>
                <InlineMarkdown text={label} />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/**
 * Labels may contain inline Markdown (`code`, **bold**, links). Block-level
 * elements are unwrapped so a label stays one line of inline content.
 */
const inlineElements = ["p", "code", "strong", "em", "del", "a"]
const inlineComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className={styles.code}>{children}</code>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={styles.link}
      onClick={(e) => e.stopPropagation()} // following a link shouldn't tick the item
    >
      {children}
    </a>
  ),
}

function InlineMarkdown({ text }: { text: string }) {
  return (
    <Markdown allowedElements={inlineElements} unwrapDisallowed components={inlineComponents}>
      {text}
    </Markdown>
  )
}
