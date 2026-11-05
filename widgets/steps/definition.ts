import { z } from "zod"
import { defineWidget, text } from "../define"

export const stepsSchema = z.object({
  title: text().describe("Short heading, e.g. '3 days in Rome', 'How a bill becomes law'."),
  steps: z
    .array(
      z.object({
        when: text()
          .nullable()
          .describe("A time marker if the sequence has one: 'Day 1', '9:00', '1969', 'Week 2'. Otherwise null."),
        title: text().describe("The step itself, 2–8 words."),
        detail: text().nullable().describe("One or two sentences of detail, or null."),
      })
    )
    .min(2)
    .max(12)
    .describe("In order. Use `when` for all steps or for none."),
})

export type StepsArgs = z.infer<typeof stepsSchema>

export const steps = defineWidget({
  name: "show_steps",
  label: "timeline",
  description: [
    "Show an ordered sequence to read through: an itinerary ('3 days in Rome'), how a process unfolds",
    "('how a bill becomes law', 'what happens when you type a URL'), or a history ('timeline of the moon landing').",
    "Not for tasks the user will do and tick off: setup steps, packing, todos and launch prep use the checklist.",
    "Not for a single fact or a short answer; not for comparisons.",
  ].join(" "),
  schema: stepsSchema,
})
