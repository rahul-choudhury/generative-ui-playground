import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rahul-choudhury/ui/components"
import type { ModelOption } from "../../shared/protocol"
import styles from "./model-select.module.css"

type Props = {
  models: ModelOption[]
  selected: string | undefined
  onSelect: (id: string) => void
}

// Always two decimals, so "$1.00" and "$0.10" are the same width.
const price = (usd: number | null) => (usd === null ? "?" : `$${usd.toFixed(2)}`)

/**
 * Which model answers the next message, styled as quietly as the usage
 * indicator opposite. The menu shows each model's price, since they differ by up to 20×.
 */
export function ModelSelect({ models, selected, onSelect }: Props) {
  if (models.length === 0 || !selected) return null
  const labelFor = (id: string) => models.find((m) => m.id === id)?.label ?? id

  return (
    <Select size="sm" value={selected} onValueChange={(value) => value && onSelect(value as string)}>
      <SelectTrigger
        variant="ghost"
        aria-label="Model for the next message"
        className={styles.trigger}
      >
        <SelectValue>{(value: string) => labelFor(value)}</SelectValue>
      </SelectTrigger>
      {/* The menu is wider than the trigger, so line up their left edges. */}
      <SelectContent side="top" align="start" alignItemWithTrigger={false} className={styles.popup}>
        {/* Column headings for sighted users; each row spells them out for
            screen readers instead. */}
        <div aria-hidden className={`${styles.columns} ${styles.header}`}>
          <span>Model</span>
          <span className={styles.right}>In</span>
          <span className={styles.right}>Out</span>
        </div>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className={styles.item}>
            <span className={styles.columns}>
              <span>{model.label}</span>
              <span className={styles.price}>
                <span className="sr-only">input </span>
                {price(model.inputPerMillion)}
              </span>
              <span className={styles.price}>
                <span className="sr-only">output </span>
                {price(model.outputPerMillion)}
              </span>
            </span>
          </SelectItem>
        ))}
        <p className={styles.footer}>
          USD per 1M tokens · applies to your next message
        </p>
      </SelectContent>
    </Select>
  )
}
