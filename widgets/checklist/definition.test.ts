import { describe, expect, test } from "bun:test"
import { checklist, type ChecklistArgs } from "./definition"

const args: ChecklistArgs = {
  title: "Oslo packing",
  items: [
    { label: "Passport", checked: false },
    { label: "Charger", checked: false },
    { label: "Umbrella", checked: true },
    { label: "Gloves", checked: false },
  ],
}
const state = checklist.state!
const initial = state.initial(args)

describe("checklist state", () => {
  test("starts from the model's checked flags", () => {
    expect(initial).toEqual([false, false, true, false])
  })

  test("describes ticks, with the running total", () => {
    expect(state.describeChange(args, initial, [true, false, true, false])).toBe(
      'In the checklist "Oslo packing": ticked "Passport". Now 2 of 4 done.'
    )
    expect(state.describeChange(args, initial, [true, true, true, true])).toBe(
      'In the checklist "Oslo packing": ticked "Passport", "Charger" and "Gloves". Now 4 of 4 done.'
    )
  })

  test("describes ticks and unticks together", () => {
    expect(state.describeChange(args, initial, [true, false, false, false])).toBe(
      'In the checklist "Oslo packing": ticked "Passport"; unticked "Umbrella". Now 1 of 4 done.'
    )
  })

  test("says nothing when nothing changed", () => {
    expect(state.describeChange(args, initial, [...initial])).toBeNull()
  })

  test("says nothing for a snapshot that doesn't match the list", () => {
    expect(state.describeChange(args, initial, [true, true])).toBeNull()
  })
})
