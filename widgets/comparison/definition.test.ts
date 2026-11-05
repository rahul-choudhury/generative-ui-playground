import { describe, expect, test } from "bun:test"
import { validateWidget } from "../validate"

const table = {
  title: null,
  subjects: ["Tokyo", "Osaka"],
  rows: [
    { label: "Food", values: ["Everything", "Street food"], best: 1 },
    { label: "Size", values: ["Huge", "Compact"], best: null },
  ],
  verdict: "Tokyo for variety, Osaka for food.",
}

describe("comparison validation (beyond what strict mode enforces)", () => {
  test("a well-formed table is valid", () => {
    expect(validateWidget("show_comparison", table).status).toBe("ok")
  })

  test("a row with the wrong number of values is rejected, with its path", () => {
    const result = validateWidget("show_comparison", {
      ...table,
      rows: [table.rows[0], { label: "Size", values: ["Huge"], best: null }],
    })
    expect(result).toEqual({ status: "invalid", issues: ["rows.1.values: has 1 values for 2 subjects"] })
  })

  test("a 'best' pointing past the last subject is rejected", () => {
    const result = validateWidget("show_comparison", {
      ...table,
      rows: [{ ...table.rows[0], best: 2 }, table.rows[1]],
    })
    expect(result).toEqual({ status: "invalid", issues: ["rows.0.best: points past the last subject"] })
  })
})
