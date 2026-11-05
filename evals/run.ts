/**
 * Runs the eval cases against the real model (weather uses fixed data).
 *
 *   bun run evals                     every case once
 *   bun run evals --runs 3            each case 3×, to expose flaky behaviour
 *   bun run evals --filter weather    only cases whose name or group matches
 *
 * Separate from `bun test`: it calls the real model, so it costs money
 * (about a cent per full run) and results vary between runs. Exits non-zero
 * if any case fails.
 */
import { mkdir } from "node:fs/promises"
import { cases } from "./cases"
import { runCase, type Case, type CaseRun, type TurnOutcome } from "./harness"

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const runs = Number(flag("runs") ?? 1)
const filter = flag("filter")?.toLowerCase()
const concurrency = Number(flag("concurrency") ?? 6)

const selected = cases.filter((c) => !filter || `${c.group} ${c.name}`.toLowerCase().includes(filter))
if (selected.length === 0) {
  console.error(`No cases match "${filter}".`)
  process.exit(1)
}

// Every (case, run) pair, run with limited concurrency.
const jobs = selected.flatMap((testCase) => Array.from({ length: runs }, () => testCase))
const results = new Map<Case, CaseRun[]>(selected.map((c) => [c, []]))
const started = performance.now()
let done = 0

async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const run = await runCase(job)
    results.get(job)!.push(run)
    process.stdout.write(`\r  ${++done}/${selected.length * runs} runs`)
  }
}
console.log(`Running ${selected.length} case(s) × ${runs} run(s)…`)
await Promise.all(Array.from({ length: concurrency }, worker))
process.stdout.write("\r")

// ─── Report ─────────────────────────────────────────────────────────────────

/** What the model did in one turn, compactly: widgets with key args, then text. */
function summarizeTurn(turn: TurnOutcome) {
  const widgets = turn.widgets.map((w) => {
    const args = JSON.stringify(w.args ?? {})
    const result = w.result ? ` → ${w.result.status}` : ""
    return `${w.name.replace("show_", "")}${args.length > 60 ? `${args.slice(0, 57)}…}` : args}${result}`
  })
  const text = turn.text ? `"${turn.text.replace(/\s+/g, " ").slice(0, 70)}${turn.text.length > 70 ? "…" : ""}"` : ""
  return [...widgets, text].filter(Boolean).join(" + ") || "(nothing)"
}

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n))
let totalCost = 0
let failedCases = 0
let group = ""

for (const testCase of selected) {
  const caseRuns = results.get(testCase)!
  const passes = caseRuns.filter((r) => r.passed).length
  const cost = caseRuns.reduce((sum, r) => sum + r.costUsd, 0)
  totalCost += cost
  if (passes < caseRuns.length) failedCases++

  if (testCase.group !== group) {
    group = testCase.group
    console.log(`\n${group.toUpperCase()}`)
  }
  const mark = passes === caseRuns.length ? "✓" : passes === 0 ? "✗" : "~"
  const rate = runs > 1 ? ` ${passes}/${caseRuns.length}` : ""
  // Show the last run: a failing one if there is one, so the report explains failures.
  const shown = caseRuns.find((r) => !r.passed) ?? caseRuns.at(-1)!
  console.log(`  ${mark}${rate} ${pad(testCase.name, 48)} ${shown.turns.map(summarizeTurn).join("  ⟶  ")}`)
  for (const failure of [...new Set(caseRuns.flatMap((r) => r.failures))]) console.log(`      ↳ ${failure}`)
}

const seconds = ((performance.now() - started) / 1000).toFixed(0)
console.log(
  `\n${selected.length - failedCases}/${selected.length} cases passed` +
    `${runs > 1 ? " every run" : ""} · $${totalCost.toFixed(4)} · ${seconds}s`
)

// Full results, for comparing runs.
await mkdir("evals/results", { recursive: true })
const file = `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`
await Bun.write(
  file,
  JSON.stringify(
    selected.map((c) => ({ group: c.group, name: c.name, runs: results.get(c) })),
    null,
    2
  )
)
console.log(`Details: ${file}`)

process.exit(failedCases > 0 ? 1 : 0)
