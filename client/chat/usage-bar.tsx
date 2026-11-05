import { cn } from "@rahul-choudhury/ui"
import { Popover, PopoverContent, PopoverTrigger } from "@rahul-choudhury/ui/components"
import type { ChatMessage } from "./use-chat"
import {
  formatTokens,
  formatTokensFull,
  formatUsd,
  formatUsdPrecise,
  summarizeUsage,
} from "./usage"

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
    <div className="ml-auto">
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-xs text-text-muted tabular-nums",
            "cursor-pointer transition-colors hover:bg-surface-soft hover:text-text-secondary",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          )}
          aria-label="Context and cost details"
        >
          {max !== null && (
            <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-surface-soft">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isLongContext ? "bg-warning" : "bg-text-muted"
                )}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
              {thresholdPct !== null && (
                <span
                  className="absolute inset-y-0 w-px bg-warning"
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

        <PopoverContent side="top" align="end" sideOffset={6} className="w-72 text-sm">
          <Section title="Context">
            <Row
              label="Used"
              value={`${formatTokensFull(s.contextTokens)}${max ? ` of ${formatTokensFull(max)}` : ""}`}
            />
            {max !== null && (
              <Row label="" value={pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`} sub />
            )}
            {threshold !== null && (
              <p className="mt-1 text-xs text-text-muted">
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
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Cost" value={formatUsdPrecise(s.totals.costUsd)} strong />
            </div>
          </Section>

          {(notCounted > 0 || s.serviceTier || s.lastModel) && (
            <div className="mt-3 flex flex-col gap-1 text-xs text-text-muted">
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
                  Last reply: <span className="font-mono">{s.lastModel}</span>
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
    <div className="not-first:mt-4">
      <p className="mb-1.5 text-xs font-medium text-text-muted">{title}</p>
      {children}
    </div>
  )
}

function Row(props: { label: string; value: string; sub?: boolean; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 py-0.5 tabular-nums",
        props.sub && "pl-3 text-text-muted",
        props.strong && "font-semibold"
      )}
    >
      <span>{props.label}</span>
      <span>{props.value}</span>
    </div>
  )
}
