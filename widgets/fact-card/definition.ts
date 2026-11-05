import { z } from "zod"
import { defineWidget } from "../define"

// OpenAI strict mode requires every field, so "optional" is expressed as
// nullable: the model sends null instead of leaving the field out.
export const factCardSchema = z.object({
  subject: z.string().describe("The one thing these facts are about, e.g. 'Tokyo', 'Helium', 'Frida Kahlo'."),
  descriptor: z
    .string()
    .describe("Short lowercase phrase saying what the subject is, e.g. 'capital of Japan', 'chemical element', 'Mexican painter'."),
  headline: z
    .object({
      value: z.string().describe("Short figure, e.g. '37.4M', '4.0026 u', '1907–1954'."),
      label: z.string().describe("What the figure is, lowercase, e.g. 'metro population'."),
    })
    .nullable()
    .describe("The single most notable figure, shown large. null if nothing stands out."),
  facts: z
    .array(
      z.object({
        label: z.string().describe("1–3 words, sentence case, e.g. 'Time zone'."),
        value: z
          .string()
          .describe("1–5 words: a number with unit, a name, a date, or a short list. Never a sentence or clause, e.g. '2nd most abundant', not 'Second-most abundant element, after hydrogen'."),
      })
    )
    .min(2)
    .max(8)
    .describe("Key facts, most useful first. Don't repeat the headline."),
  asOf: z
    .string()
    .nullable()
    .describe("Year the figures date from if they change over time, e.g. '2024'. null for timeless facts."),
})

export type FactCardArgs = z.infer<typeof factCardSchema>

export const factCard = defineWidget({
  name: "show_fact_card",
  label: "fact card",
  description: [
    "Show a compact reference card of key facts about ONE specific subject:",
    "a city, country, person, company, chemical element, planet, landmark, animal and similar.",
    "Use when the user asks for facts, stats, an overview or 'tell me about' a single subject.",
    "Do not use for explanations, how-to answers, opinions, comparisons of several subjects,",
    "or facts you are unsure of. Answer those in text instead.",
  ].join(" "),
  schema: factCardSchema,
})
