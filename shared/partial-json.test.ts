import { describe, expect, test } from "bun:test"
import { parsePartialJson } from "./partial-json"

describe("parsePartialJson", () => {
  test.each([
    ["", undefined],
    ["{", {}],
    ['{"ti', {}],
    ['{"title"', {}],
    ['{"title":', {}],
    ['{"title":"', { title: "" }],
    ['{"title":"Tok', { title: "Tok" }],
    ['{"title":"Tokyo"', { title: "Tokyo" }],
    ['{"title":"Tokyo",', { title: "Tokyo" }],
    ['{"title":"Tokyo","it', { title: "Tokyo" }],
    ['{"title":"Tokyo","items":[', { title: "Tokyo", items: [] }],
    ['{"title":"Tokyo","items":[{"label":"Pass', { title: "Tokyo", items: [{ label: "Pass" }] }],
    ['{"items":[{"label":"Passport","checked":fal', { items: [{ label: "Passport" }] }],
    ['{"items":[{"label":"Passport","checked":false', { items: [{ label: "Passport" }] }],
    ['{"items":[{"label":"Passport","checked":false}', { items: [{ label: "Passport", checked: false }] }],
    ['{"headline":nu', {}],
    ['{"headline":null,', { headline: null }],
    ['{"n":12', {}],
    ['{"n":12,', { n: 12 }],
    ['{"n":-1.5e3}', { n: -1500 }],
    ['["a","b', ["a", "b"]],
  ])("%j → %j", (input, expected) => {
    expect(parsePartialJson(input)).toEqual(expected)
  })

  test("escapes: a dangling backslash or half a \\u escape is dropped", () => {
    expect(parsePartialJson('{"a":"say \\')).toEqual({ a: "say " })
    expect(parsePartialJson('{"a":"say \\"hi')).toEqual({ a: 'say "hi' })
    expect(parsePartialJson('{"a":"caf\\u00')).toEqual({ a: "caf" })
    expect(parsePartialJson('{"a":"caf\\u00e9')).toEqual({ a: "café" })
    expect(parsePartialJson('{"a":"x\\\\')).toEqual({ a: "x\\" })
  })

  test("structural characters inside strings are just text", () => {
    expect(parsePartialJson('{"a":"{[,:]}","b":"c')).toEqual({ a: "{[,:]}", b: "c" })
  })

  // The real guarantee: feed every prefix of a realistic argument string,
  // as the stream would. Nothing throws, and each result only ever shows
  // data that is part of the final value (no invented or wrong content).
  test("every prefix of a real argument string is a partial of the final value", () => {
    const final = {
      subject: "Tokyo",
      descriptor: "capital of \"Japan\" — 東京",
      headline: { value: "14.18M", label: "residents" },
      facts: [
        { label: "Area", value: "2,194 km²" },
        { label: "Founded", value: "1457, as Edo" },
      ],
      asOf: null,
      escaped: "tab\there, bell\u0007, slash\\", // serialised with \t, \u0007, \\
      ok: true,
      n: -12.5,
    }
    for (const json of [JSON.stringify(final), JSON.stringify(final, null, 2)]) {
      for (let end = 0; end <= json.length; end++) {
        const partial = parsePartialJson(json.slice(0, end))
        if (partial !== undefined) expect(isPartialOf(partial, final)).toBe(true)
      }
      expect(parsePartialJson(json)).toEqual(final)
    }
  })
})

/** True if `partial` could be an earlier snapshot of `final`. */
function isPartialOf(partial: unknown, final: unknown): boolean {
  if (typeof partial === "string") return typeof final === "string" && final.startsWith(partial)
  if (Array.isArray(partial)) {
    return (
      Array.isArray(final) &&
      partial.length <= final.length &&
      partial.every((item, i) => isPartialOf(item, final[i]))
    )
  }
  if (partial !== null && typeof partial === "object") {
    return (
      final !== null &&
      typeof final === "object" &&
      !Array.isArray(final) &&
      Object.entries(partial).every(
        ([key, value]) => key in final && isPartialOf(value, (final as Record<string, unknown>)[key])
      )
    )
  }
  return partial === final
}
