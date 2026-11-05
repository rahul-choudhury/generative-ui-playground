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
      assistant({ type: "widget", id: "call_3", name: "show_horoscope", args: { city: "Oslo" } }),
    ])
    expect((output as { output: string }).output).toBe(
      'Not shown: there is no widget named "show_horoscope". The user saw an error message instead.'
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
        { type: "widget", id: "b", name: "show_horoscope", args: {} },
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

describe("toOpenAIInput: widget state events", () => {
  const twoItems = {
    title: "Packing",
    items: [
      { label: "Passport", checked: false },
      { label: "Charger", checked: false },
    ],
  }
  const listWidget = assistant({ type: "widget", id: "w1", name: "show_checklist", args: twoItems })
  const userWith = (text: string, ...states: unknown[]): Message => ({
    id: crypto.randomUUID(),
    role: "user",
    parts: [
      ...states.map((state) => ({ type: "widget-state" as const, widgetId: "w1", state })),
      { type: "text" as const, text },
    ],
  })
  const contents = (items: ReturnType<typeof toOpenAIInput>) =>
    items.flatMap((i) => {
      const content = (i as { content?: unknown }).content
      return typeof content === "string" ? [content] : []
    })

  test("a snapshot becomes a note just before the user's text", () => {
    const items = toOpenAIInput([user("pack list"), listWidget, userWith("what's left?", [true, false])])
    expect(items.slice(-2)).toEqual([
      {
        role: "user",
        content: [
          "<widget_events>",
          "Since your last reply, the user did this in widgets shown earlier:",
          '- In the checklist "Packing": ticked "Passport". Now 1 of 2 done.',
          "</widget_events>",
        ].join("\n"),
      },
      { role: "user", content: "what's left?" },
    ])
  })

  test("the widget's own output never changes, so earlier history stays cacheable", () => {
    const before = toOpenAIInput([user("pack list"), listWidget])
    const after = toOpenAIInput([user("pack list"), listWidget, userWith("done", [true, true])])
    expect(after.slice(0, before.length)).toEqual(before)
  })

  test("each snapshot is described relative to the previous one", () => {
    const items = toOpenAIInput([
      listWidget,
      userWith("first", [true, false]),
      assistant({ type: "text", text: "ok" }),
      userWith("second", [true, true]),
    ])
    const notes = contents(items).filter((c) => c.startsWith("<widget_events>"))
    expect(notes).toHaveLength(2)
    expect(notes[0]).toContain('ticked "Passport". Now 1 of 2')
    expect(notes[1]).toContain('ticked "Charger". Now 2 of 2') // not Passport again
  })

  test("no change, unknown widgets and invalid snapshots produce no note", () => {
    for (const message of [
      userWith("unchanged", [false, false]),
      userWith("bad shape", "not an array"),
      { ...userWith("unknown"), parts: [{ type: "widget-state" as const, widgetId: "nope", state: [true] }, { type: "text" as const, text: "unknown" }] },
    ]) {
      const items = toOpenAIInput([listWidget, message])
      expect(contents(items).some((c) => c.startsWith("<widget_events>"))).toBe(false)
    }
  })
})

describe("toOpenAIInput: data widgets", () => {
  const weatherArgs = { location: "Oslo", country: null, days: 1, units: "celsius" }
  const weatherData = {
    place: { name: "Oslo", region: "Oslo", country: "Norway", timezone: "Europe/Oslo" },
    units: "celsius",
    current: { time: "2026-11-05T21:45", temperature: 3.1, feelsLike: 0.2, code: 0, isDay: false, windSpeed: 6.1 },
    daily: [{ date: "2026-11-06", code: 61, max: 5, min: 0.7, precipitationChance: 80 }],
  }
  const outputFor = (result?: unknown) => {
    const [, output] = toOpenAIInput([
      assistant({ type: "widget", id: "w", name: "show_weather", args: weatherArgs, result: result as never }),
    ])
    return (output as { output: string }).output
  }

  test("the model is told the fetched figures, with the place's local date", () => {
    // Now is Thu 5 Nov there, so the 6th is labelled "tomorrow": without the
    // date, the model was observed treating the first day as tomorrow.
    expect(outputFor({ status: "ok", data: weatherData })).toBe(
      [
        "Shown to the user: live weather for Oslo, Norway.",
        "Local date and time there: Thu 5 Nov, 21:45 (Europe/Oslo).",
        "Now: 3°C, feels like 0°C, clear, wind 6 km/h.",
        "Fri 6 Nov (tomorrow): light rain, 1 to 5°C, 80% chance of precipitation.",
        "Only these 1 day(s) were fetched. For other days, show the weather again with more days.",
        "Source: Open-Meteo. Use only these figures; don't invent others.",
        "If the user asked what to pack or wear for a trip (several items), show that now as a checklist based on these figures.",
        "A yes/no question ('should I bring an umbrella?', 'do I need a coat?') gets a one-sentence answer and no widget.",
      ].join("\n")
    )
  })

  test("a failed fetch passes its reason on", () => {
    expect(outputFor({ status: "error", message: "Couldn't find a place called “Oslo”." })).toBe(
      "Not shown: Couldn't find a place called “Oslo”. The user saw this error instead. Tell them briefly and suggest what they could do (e.g. check the spelling, add the country)."
    )
  })

  test("no result (stopped mid-fetch) or bad data is never reported as shown", () => {
    expect(outputFor(undefined)).toStartWith("Not shown: the reply was interrupted")
    expect(outputFor({ status: "ok", data: { place: "nope" } })).toStartWith("Not shown: the fetched data was invalid")
  })
})
