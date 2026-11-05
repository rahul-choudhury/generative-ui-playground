import { describe, expect, test } from "bun:test"
import type { Message, Part } from "../../shared/protocol"
import { toOpenAIInput } from "./history"

const user = (text: string): Message => ({
  id: crypto.randomUUID(),
  role: "user",
  parts: [{ type: "text", text }],
})

const assistant = (...parts: Part[]): Message => ({
  id: crypto.randomUUID(),
  role: "assistant",
  parts,
})

const checklistArgs = { title: "Packing", items: [{ label: "Passport", checked: false }] }

describe("toOpenAIInput", () => {
  test("text-only turns become role messages", () => {
    expect(toOpenAIInput([user("hi"), assistant({ type: "text", text: "hello" })])).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ])
  })

  test("a valid widget becomes a call plus 'Shown to the user.', in part order", () => {
    const items = toOpenAIInput([
      assistant(
        { type: "text", text: "Here you go:" },
        { type: "widget", id: "call_1", name: "show_checklist", args: checklistArgs },
        { type: "text", text: "Anything else?" }
      ),
    ])
    expect(items).toEqual([
      { role: "assistant", content: "Here you go:" },
      {
        type: "function_call",
        call_id: "call_1",
        name: "show_checklist",
        arguments: JSON.stringify(checklistArgs),
      },
      { type: "function_call_output", call_id: "call_1", output: "Shown to the user." },
      { role: "assistant", content: "Anything else?" },
    ])
  })

  test("an invalid widget tells the model it wasn't shown, and why", () => {
    const [, output] = toOpenAIInput([
      assistant({ type: "widget", id: "call_2", name: "show_checklist", args: { title: "x", items: [] } }),
    ])
    expect(output).toMatchObject({ type: "function_call_output", call_id: "call_2" })
    const text = (output as { output: string }).output
    expect(text).toStartWith("Not shown: invalid arguments (items: ")
    expect(text).toEndWith("The user saw an error message instead.")
  })

  test("an unknown widget tells the model it doesn't exist", () => {
    const [, output] = toOpenAIInput([
      assistant({ type: "widget", id: "call_3", name: "show_weather", args: { city: "Oslo" } }),
    ])
    expect((output as { output: string }).output).toBe(
      'Not shown: there is no widget named "show_weather". The user saw an error message instead.'
    )
  })

  test("a widget stopped before its arguments arrived is dropped entirely", () => {
    expect(
      toOpenAIInput([
        assistant(
          { type: "text", text: "Here's a list:" },
          { type: "widget", id: "call_4", name: "show_checklist" }
        ),
      ])
    ).toEqual([{ role: "assistant", content: "Here's a list:" }])
  })

  test("every function_call has exactly one matching output (the API requires it)", () => {
    const items = toOpenAIInput([
      user("lists please"),
      assistant(
        { type: "widget", id: "a", name: "show_checklist", args: checklistArgs },
        { type: "widget", id: "b", name: "show_weather", args: {} },
        { type: "widget", id: "c", name: "show_checklist" }
      ),
    ])
    const calls = items.filter((i) => "type" in i && i.type === "function_call").map((i) => (i as { call_id: string }).call_id)
    const outputs = items
      .filter((i) => "type" in i && i.type === "function_call_output")
      .map((i) => (i as { call_id: string }).call_id)
    expect(calls).toEqual(["a", "b"])
    expect(outputs).toEqual(calls)
  })
})
