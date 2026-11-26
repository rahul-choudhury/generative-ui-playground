import { Button, Popover, PopoverContent, PopoverTrigger } from "@rahul-choudhury/ui/components"
import type { ChatMessage } from "./use-chat"
import {
  formatTokens,
  formatTokensFull,
  formatUsd,
  formatUsdPrecise,
  summarizeUsage,
} from "./usage"
import styles from "./usage-bar.module.css"

/**
 * "Context ▓░░ 12K / 922K · $0.0031". Click for the full breakdown.
 * Hidden until the first reply reports usage.
 */
export function UsageBar({ messages }: { messages: ChatMessage[] }) {
  const s = summarizeUsage(messages)
  if (!s.hasUsage) return null

  const max = s.maxInputTokens
  const threshold = s.longContextThreshold
  const pct = max ? Math.min(100, (s.contextTokens / max) * 100) : 0
  const thresholdPct = max && threshold ? (threshold / max) * 100 : null
  const isLongContext = threshold !== null && s.contextTokens > threshold
  const notCounted = s.stoppedCount + s.unpricedCount

  return (
    <div className={styles.root}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={styles.trigger}
            />
          }
          aria-label="Context and cost details"
        >
          {max !== null && (
            <span className={styles.meter}>
              <span
                className={styles.fill}
                data-long={isLongContext || undefined}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
              {thresholdPct !== null && (
                <span
                  className={styles.threshold}
                  style={{ left: `${thresholdPct}%` }}
                />
              )}
            </span>
          )}
          <span>
            {formatTokens(s.contextTokens)}
            {max !== null && ` / ${formatTokens(max)}`}
          </span>
          <span aria-hidden>·</span>
          <span>
            {formatUsd(s.totals.costUsd)}
            {notCounted > 0 && "+"}
          </span>
        </PopoverTrigger>

        <PopoverContent side="top" align="end" sideOffset={6} className={styles.popup}>
          <Section title="Context">
            <Row
              label="Used"
              value={`${formatTokensFull(s.contextTokens)}${max ? ` of ${formatTokensFull(max)}` : ""}`}
            />
            {max !== null && (
              <Row label="" value={pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`} sub />
            )}
            {threshold !== null && (
              <p className={styles.note}>
                Above {formatTokensFull(threshold)} input tokens, every request is billed at
                long-context rates (2× input, 1.5× output).
              </p>
            )}
          </Section>

          <Section title="This conversation">
            <Row label="Input" value={formatTokensFull(s.totals.input)} />
            <Row label="Cache reads" value={formatTokensFull(s.totals.cached)} sub />
            <Row label="Cache writes" value={formatTokensFull(s.totals.cacheWrites)} sub />
            <Row label="Output" value={formatTokensFull(s.totals.output)} />
            <Row label="Reasoning" value={formatTokensFull(s.totals.reasoning)} sub />
            <div className={styles.total}>
              <Row label="Cost" value={formatUsdPrecise(s.totals.costUsd)} strong />
            </div>
          </Section>

          {(notCounted > 0 || s.serviceTier || s.lastModel) && (
            <div className={styles.notes}>
              {s.stoppedCount > 0 && (
                <p>
                  {s.stoppedCount} stopped {s.stoppedCount === 1 ? "reply" : "replies"} not
                  counted (no usage reported).
                </p>
              )}
              {s.unpricedCount > 0 && (
                <p>
                  {s.unpricedCount} {s.unpricedCount === 1 ? "reply" : "replies"} on an
                  unpriced model or tier not counted.
                </p>
              )}
              {s.lastModel && (
                <p>
                  Last reply: <span className={styles.mono}>{s.lastModel}</span>
                  {s.modelCount > 1 && ` (this conversation used ${s.modelCount} models)`}.
                </p>
              )}
              {s.serviceTier && <p>Priced at OpenAI {s.serviceTier} rates.</p>}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      {children}
    </div>
  )
}

function Row(props: { label: string; value: string; sub?: boolean; strong?: boolean }) {
  return (
    <div className={styles.row} data-sub={props.sub || undefined} data-strong={props.strong || undefined}>
      <span>{props.label}</span>
      <span>{props.value}</span>
    </div>
  )
}
