import { describe, expect, test } from "bun:test"
import { validateWidget } from "./validate"

const validChecklist = {
  title: "Packing",
  items: [{ label: "Passport", checked: false }],
}

const validFactCard = {
  subject: "Helium",
  descriptor: "chemical element",
  headline: { value: "2", label: "atomic number" },
  facts: [
    { label: "Symbol", value: "He" },
    { label: "Group", value: "Noble gas" },
  ],
  asOf: null,
}

describe("validateWidget", () => {
  test("accepts valid arguments for each registered widget", () => {
    expect(validateWidget("show_checklist", validChecklist).status).toBe("ok")
    expect(validateWidget("show_fact_card", validFactCard).status).toBe("ok")
  })

  test("returns the parsed data, with strings trimmed", () => {
    const result = validateWidget("show_checklist", {
      ...validChecklist,
      title: "  Packing  ",
    })
    expect(result).toEqual({ status: "ok", data: { ...validChecklist, title: "Packing" } })
  })

  test("reports unknown widget names", () => {
    expect(validateWidget("show_weather", { city: "Oslo" })).toEqual({ status: "unknown" })
  })

  test("reports each problem with its path", () => {
    const result = validateWidget("show_fact_card", {
      ...validFactCard,
      facts: [{ label: "Symbol", value: "He" }],
    })
    expect(result.status).toBe("invalid")
    if (result.status !== "invalid") return
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toStartWith("facts: ")
  })

  test("rejects blank strings, which OpenAI strict mode lets through", () => {
    // Observed from the real model: minLength blocks "" but not " ".
    const result = validateWidget("show_checklist", {
      title: "Packing",
      items: [{ label: " ", checked: false }],
    })
    expect(result.status).toBe("invalid")
    if (result.status !== "invalid") return
    expect(result.issues[0]).toStartWith("items.0.label: ")
  })

  test("rejects unparseable arguments (the server passes null)", () => {
    expect(validateWidget("show_checklist", null).status).toBe("invalid")
  })
})
