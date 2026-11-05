import type { ChatMessage } from "./use-chat"

/**
 * Conversation-level numbers, derived from per-message usage. Nothing here
 * is stored separately; it's recomputed from the messages.
 */
export function summarizeUsage(messages: ChatMessage[]) {
  const withUsage = messages.filter((m) => m.usage)
  const latest = withUsage.at(-1)?.usage

  // Each request re-sends the whole history, so the LATEST response's input
  // already is the full conversation. Its reply joins the history next turn.
  // Reasoning tokens aren't sent back, so they don't occupy context.
  const contextTokens = latest
    ? latest.inputTokens + latest.outputTokens - latest.reasoningTokens
    : 0

  const totals = { input: 0, cached: 0, cacheWrites: 0, output: 0, reasoning: 0, costUsd: 0 }
  let unpricedCount = 0
  for (const { usage } of withUsage) {
    if (!usage) continue
    totals.input += usage.inputTokens
    totals.cached += usage.cachedInputTokens
    totals.cacheWrites += usage.cacheWriteTokens
    totals.output += usage.outputTokens
    totals.reasoning += usage.reasoningTokens
    if (usage.costUsd === null) unpricedCount++
    else totals.costUsd += usage.costUsd
  }

  return {
    hasUsage: withUsage.length > 0,
    contextTokens,
    maxInputTokens: latest?.maxInputTokens ?? null,
    longContextThreshold: latest?.longContextThreshold ?? null,
    serviceTier: latest?.serviceTier ?? null,
    totals,
    unpricedCount,
    // Stopped replies are billed by OpenAI but report no usage.
    stoppedCount: messages.filter((m) => m.status === "stopped").length,
  }
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat("en")

export const formatTokens = (n: number) => compact.format(n)
export const formatTokensFull = (n: number) => full.format(n)

/** Short form for the bar: 2 significant digits under $1, cents above. */
export function formatUsd(usd: number) {
  if (usd === 0) return "$0.00"
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    ...(usd < 1 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 2 }),
  }).format(usd)
}

/** Long form for the breakdown. */
export const formatUsdPrecise = (usd: number) => `$${usd.toFixed(6)}`
