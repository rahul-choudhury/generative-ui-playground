import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rahul-choudhury/ui/components"
import type { ModelOption } from "../../shared/protocol"

type Props = {
  models: ModelOption[]
  selected: string | undefined
  onSelect: (id: string) => void
}

const price = (usd: number | null) => (usd === null ? "?" : `$${usd < 1 ? usd.toFixed(2) : usd}`)

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
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="h-auto gap-4 py-2">
            <span className="flex w-full items-baseline justify-between gap-6">
              <span>{model.label}</span>
              <span className="text-xs text-text-muted tabular-nums">
                {price(model.inputPerMillion)} in · {price(model.outputPerMillion)} out
                <span className="sr-only"> per million tokens</span>
              </span>
            </span>
          </SelectItem>
        ))}
        <p className="border-t border-border px-2.5 py-1.5 text-[11px] text-text-muted">Per 1M tokens · applies to your next message</p>
      </SelectContent>
    </Select>
  )
}
