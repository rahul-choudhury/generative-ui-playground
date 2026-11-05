import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rahul-choudhury/ui/components"
import type { ModelOption } from "../../shared/protocol"

type Props = {
  models: ModelOption[]
  selected: string | undefined
  onSelect: (id: string) => void
}

// Always two decimals, so "$1.00" and "$0.10" are the same width.
const price = (usd: number | null) => (usd === null ? "?" : `$${usd.toFixed(2)}`)

// One set of fixed column widths for the header and every row, so the
// prices line up as columns instead of following each label's length.
const COLUMNS = "grid grid-cols-[7rem_3.25rem_3.25rem] items-baseline gap-x-3"

/**
 * Which model answers the next message. Quiet like the usage indicator it
 * sits opposite: muted text that only looks like a control on hover. The
 * menu shows each model's price, since they differ by up to 20×.
 */
export function ModelSelect({ models, selected, onSelect }: Props) {
  if (models.length === 0 || !selected) return null
  const labelFor = (id: string) => models.find((m) => m.id === id)?.label ?? id

  return (
    <Select size="sm" value={selected} onValueChange={(value) => value && onSelect(value as string)}>
      <SelectTrigger
        aria-label="Model for the next message"
        className="h-7 w-auto gap-1 border-transparent bg-transparent px-2 text-xs text-text-muted hover:border-transparent hover:bg-surface-soft hover:text-text-secondary data-popup-open:border-transparent data-popup-open:bg-surface-soft"
      >
        <SelectValue>{(value: string) => labelFor(value)}</SelectValue>
      </SelectTrigger>
      {/* The library's SelectContent always centres the menu on the trigger.
          The menu is wider, so shift it right by half the difference to line
          up their left edges (--anchor-width is the trigger's width). */}
      <SelectContent
        side="top"
        alignItemWithTrigger={false}
        className="min-w-64 translate-x-[calc((100%-var(--anchor-width))/2)]"
      >
        {/* Column headings for sighted users; each row spells them out for
            screen readers instead. */}
        <div aria-hidden className={`${COLUMNS} px-2.5 pt-2 pb-1 text-[11px] text-text-muted`}>
          <span>Model</span>
          <span className="text-right">In</span>
          <span className="text-right">Out</span>
        </div>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="h-auto gap-3 py-2">
            <span className={COLUMNS}>
              <span>{model.label}</span>
              <span className="text-right text-xs text-text-muted tabular-nums">
                <span className="sr-only">input </span>
                {price(model.inputPerMillion)}
              </span>
              <span className="text-right text-xs text-text-muted tabular-nums">
                <span className="sr-only">output </span>
                {price(model.outputPerMillion)}
              </span>
            </span>
          </SelectItem>
        ))}
        <p className="border-t border-border px-2.5 py-1.5 text-[11px] text-text-muted">
          USD per 1M tokens · applies to your next message
        </p>
      </SelectContent>
    </Select>
  )
}
