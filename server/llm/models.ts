import type { Response, ResponseUsage } from "openai/resources/responses/responses"
import type { Usage } from "../../shared/protocol"

/**
 * Hand-maintained model limits and prices. OpenAI's API exposes neither, so
 * these must be updated when OpenAI changes them.
 *
 * Source: https://developers.openai.com/api/docs/models/gpt-6-luna
 *         https://developers.openai.com/api/docs/pricing
 * Last checked: 2026-11-06, confirmed against live usage objects.
 */

/** USD per 1M tokens. */
type Rates = {
  input: number
  cachedInput: number
  cacheWrite30m: number // default cache lifetime
  cacheWrite12h: number // opt-in via prompt_cache_options.ttl
  output: number // reasoning tokens are billed as output
}

type Tier = "standard" | "flex" | "fast"

type ModelInfo = {
  maxInputTokens: number
  /** Above this many input tokens, the ENTIRE request uses `long` rates. */
  longContextThreshold: number
  tiers: Partial<Record<Tier, { short: Rates; long: Rates }>>
}

const MODELS: Record<string, ModelInfo> = {
  "gpt-6-luna": {
    maxInputTokens: 922_000, // context window is 1,050,000 incl. 128,000 output
    longContextThreshold: 272_000,
    tiers: {
      standard: {
        short: { input: 0.1, cachedInput: 0.01, cacheWrite30m: 0.125, cacheWrite12h: 0.25, output: 0.5 },
        long: { input: 0.2, cachedInput: 0.02, cacheWrite30m: 0.25, cacheWrite12h: 0.5, output: 0.75 },
      },
      flex: {
        short: { input: 0.05, cachedInput: 0.005, cacheWrite30m: 0.0625, cacheWrite12h: 0.125, output: 0.25 },
        long: { input: 0.1, cachedInput: 0.01, cacheWrite30m: 0.125, cacheWrite12h: 0.25, output: 0.375 },
      },
      fast: {
        short: { input: 0.2, cachedInput: 0.02, cacheWrite30m: 0.25, cacheWrite12h: 0.5, output: 1.0 },
        long: { input: 0.4, cachedInput: 0.04, cacheWrite30m: 0.5, cacheWrite12h: 1.0, output: 1.5 },
      },
    },
  },
  // https://developers.openai.com/api/docs/models/gpt-6.1-terra, checked
  // 2026-11-06. ~10× Luna; note cached input is 95% off here, not 90%.
  "gpt-6.1-terra": {
    maxInputTokens: 922_000, // context window is 1,050,000 incl. 128,000 output
    longContextThreshold: 272_000,
    tiers: {
      standard: {
        short: { input: 1.0, cachedInput: 0.05, cacheWrite30m: 1.25, cacheWrite12h: 2.5, output: 5.0 },
        long: { input: 2.0, cachedInput: 0.1, cacheWrite30m: 2.5, cacheWrite12h: 5.0, output: 7.5 },
      },
      flex: {
        short: { input: 0.5, cachedInput: 0.025, cacheWrite30m: 0.625, cacheWrite12h: 1.25, output: 2.5 },
        long: { input: 1.0, cachedInput: 0.05, cacheWrite30m: 1.25, cacheWrite12h: 2.5, output: 3.75 },
      },
      fast: {
        short: { input: 2.0, cachedInput: 0.1, cacheWrite30m: 2.5, cacheWrite12h: 5.0, output: 10.0 },
        long: { input: 4.0, cachedInput: 0.2, cacheWrite30m: 5.0, cacheWrite12h: 10.0, output: 15.0 },
      },
    },
  },
}

/** OpenAI's reported service_tier → our price table's tier. */
function toTier(serviceTier: Response["service_tier"]): Tier | null {
  switch (serviceTier) {
    case "default":
      return "standard"
    case "flex":
      return "flex"
    case "priority": // renamed to "fast" on 2026-07-30
    case "fast":
      return "fast"
    default:
      return null // scale, ultrafast, unknown → don't guess
  }
}

/** Exact match first, then a dated snapshot like "gpt-6-luna-2026-09-22". */
function findModel(name: string): ModelInfo | undefined {
  return (
    MODELS[name] ??
    Object.entries(MODELS).find(([id]) => name.startsWith(`${id}-`))?.[1]
  )
}

/**
 * Documented but not yet in the SDK types, and not returned by gpt-6-luna as
 * of 2026-11-06. When absent, every cache write is a default 30-minute one.
 */
type CacheWriteDetails = { ttl_30m_tokens?: number; ttl_12h_tokens?: number }

export function toUsage(response: Response): Usage | null {
  const usage: ResponseUsage | undefined = response.usage
  if (!usage) return null

  const input = usage.input_tokens
  const cached = usage.input_tokens_details?.cached_tokens ?? 0
  const writes = usage.input_tokens_details?.cache_write_tokens ?? 0
  const output = usage.output_tokens
  const reasoning = usage.output_tokens_details?.reasoning_tokens ?? 0

  const model = findModel(response.model)
  const tier = toTier(response.service_tier)
  const prices = model && tier ? model.tiers[tier] : undefined

  let costUsd: number | null = null
  if (model && prices) {
    // Over the threshold, the whole request is billed at long-context rates.
    const rates = input > model.longContextThreshold ? prices.long : prices.short
    const details = (usage.input_tokens_details as { cache_write_tokens_details?: CacheWriteDetails })
      .cache_write_tokens_details
    const writes12h = details?.ttl_12h_tokens ?? 0
    const writes30m = writes - writes12h
    // cached and writes are subsets of input; don't double-count them.
    const plainInput = input - cached - writes

    costUsd =
      (plainInput * rates.input +
        cached * rates.cachedInput +
        writes30m * rates.cacheWrite30m +
        writes12h * rates.cacheWrite12h +
        output * rates.output) /
      1_000_000
  }

  return {
    inputTokens: input,
    cachedInputTokens: cached,
    cacheWriteTokens: writes,
    outputTokens: output,
    reasoningTokens: reasoning,
    costUsd,
    serviceTier: tier,
    maxInputTokens: model?.maxInputTokens ?? null,
    longContextThreshold: model?.longContextThreshold ?? null,
  }
}
