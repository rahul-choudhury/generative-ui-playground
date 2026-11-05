import { describe, expect, test } from "bun:test"
import { toOpenAIInput } from "../../server/llm/history"
import type { Message } from "../../shared/protocol"
import { choices, type ChoicesArgs } from "./definition"

const args: ChoicesArgs = {
  question: "What kind of trip?",
  options: [
    { label: "City break", description: "Museums, food, walking" },
    { label: "Hiking", description: null },
    { label: "Beach", description: null },
  ],
}
const state = choices.state!

describe("choices state", () => {
  test("starts with nothing picked", () => {
    expect(state.initial(args)).toEqual({ picked: null })
  })

  test("describes a pick by its label", () => {
    expect(state.describeChange(args, { picked: null }, { picked: 1 })).toBe(
      'In the choice "What kind of trip?": picked "Hiking". Answer now with what you know; state any assumptions rather than asking more questions.'
    )
  })

  test("says nothing for no pick, the same pick, or an out-of-range index", () => {
    expect(state.describeChange(args, { picked: null }, { picked: null })).toBeNull()
    expect(state.describeChange(args, { picked: 1 }, { picked: 1 })).toBeNull()
    expect(state.describeChange(args, { picked: null }, { picked: 7 })).toBeNull()
  })

  test("a pick reaches the model as a note plus the answer as the user's text", () => {
    const messages: Message[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "plan a trip" }] },
      { id: "a1", role: "assistant", parts: [{ type: "widget", id: "w1", name: "show_choices", args }] },
      {
        id: "u2",
        role: "user",
        parts: [
          { type: "widget-state", widgetId: "w1", state: { picked: 0 } },
          { type: "text", text: "City break" },
        ],
      },
    ]
    expect(toOpenAIInput(messages).slice(-2)).toEqual([
      {
        role: "user",
        content: [
          "<widget_events>",
          "Since your last reply, the user did this in widgets shown earlier:",
          '- In the choice "What kind of trip?": picked "City break". Answer now with what you know; state any assumptions rather than asking more questions.',
          "</widget_events>",
        ].join("\n"),
      },
      { role: "user", content: "City break" },
    ])
  })
})
