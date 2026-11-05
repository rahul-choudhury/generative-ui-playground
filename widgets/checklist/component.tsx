import { cn } from "@rahul-choudhury/ui"
import { Card, Checkbox, Skeleton } from "@rahul-choudhury/ui/components"
import { useState } from "react"
import Markdown from "react-markdown"
import { asArray, asObject, asString } from "../partial"
import type { ChecklistArgs } from "./definition"

/**
 * The finished checklist. Ticking works locally only; step 6 sends ticks back
 * to the conversation.
 */
export function Checklist({ title, items }: ChecklistArgs) {
  const [checked, setChecked] = useState(() => items.map((item) => item.checked))

  const toggle = (index: number, value: boolean) =>
    setChecked((prev) => prev.map((c, i) => (i === index ? value : c)))

  return <ChecklistLayout title={title} labels={items.map((i) => i.label)} checked={checked} onToggle={toggle} />
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
      variant="bordered"
      className="overflow-hidden"
      role="region"
      aria-label={title ?? "Checklist"}
      aria-busy={(pending && !interrupted) || undefined}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3">
        {title !== undefined ? (
          <h3 className="font-semibold">{title}</h3>
        ) : (
          <Skeleton className="h-4 w-40 self-center" />
        )}
        <span className="shrink-0 text-xs text-text-muted tabular-nums">
          {done}/{labels.length}
        </span>
      </div>

      <ul className="flex flex-col py-1.5">
        {labels.map((label, i) => (
          // Rows only animate while pending. The finished checklist mounts
          // fresh with no animation, so nothing flashes at the handover.
          <li key={i} className={cn(pending && "motion-safe:animate-row-in")}>
            <label
              className={cn(
                "flex items-start gap-3 px-4 py-1.5",
                !pending && "cursor-pointer hover:bg-surface-soft"
              )}
            >
              <Checkbox
                checked={checked[i]}
                disabled={pending}
                onCheckedChange={(value) => onToggle?.(i, value)}
                className="mt-1"
              />
              <span
                className={cn(
                  "text-[15px] leading-6 transition-colors",
                  checked[i] && "text-text-muted line-through"
                )}
              >
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
    <code className="rounded-sm bg-surface-soft px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
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
