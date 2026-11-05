import OpenAI from "openai"
import type { ReasoningEffort } from "openai/resources/shared"

export const openai = new OpenAI() // reads OPENAI_API_KEY from the environment

export const model = process.env.OPENAI_MODEL ?? "gpt-6-luna"

const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const

/**
 * OPENAI_REASONING_EFFORT overrides the model's default (medium for
 * gpt-6-luna). Unset means "send nothing", so the model's own default
 * applies. Higher effort can follow instructions more reliably, at the cost
 * of latency and reasoning tokens (billed as output).
 */
export const reasoningEffort: ReasoningEffort | undefined = (() => {
  const value = process.env.OPENAI_REASONING_EFFORT
  if (!value) return undefined
  if ((EFFORTS as readonly string[]).includes(value)) return value as ReasoningEffort
  throw new Error(`OPENAI_REASONING_EFFORT must be one of ${EFFORTS.join(", ")}; got "${value}"`)
})()
