import { cn } from "@rahul-choudhury/ui"
import { Card, Checkbox } from "@rahul-choudhury/ui/components"
import { useState } from "react"
import Markdown from "react-markdown"
import type { ChecklistArgs } from "./definition"

/**
 * Ticking works locally only. Step 6 sends ticks back to the conversation.
 */
export function Checklist({ title, items }: ChecklistArgs) {
  const [checked, setChecked] = useState(() => items.map((item) => item.checked))
  const done = checked.filter(Boolean).length

  const toggle = (index: number, value: boolean) =>
    setChecked((prev) => prev.map((c, i) => (i === index ? value : c)))

  return (
    <Card variant="bordered" className="overflow-hidden" role="region" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="shrink-0 text-xs text-text-muted tabular-nums">
          {done}/{items.length}
        </span>
      </div>

      <ul className="flex flex-col py-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-1.5 hover:bg-surface-soft">
              <Checkbox
                checked={checked[i]}
                onCheckedChange={(value) => toggle(i, value)}
                className="mt-1"
              />
              <span
                className={cn(
                  "text-[15px] leading-6 transition-colors",
                  checked[i] && "text-text-muted line-through"
                )}
              >
                <InlineMarkdown text={item.label} />
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
