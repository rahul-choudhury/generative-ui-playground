import { z } from "zod"
import { defineWidget, text } from "../define"

export const comparisonSchema = z
  .object({
    title: text()
      .nullable()
      .describe("What the comparison is for, if the user said, e.g. 'For a first-time visitor'. Otherwise null."),
    subjects: z
      .array(text().describe("A column: one thing being compared, 1–3 words, e.g. 'Tokyo'."))
      .min(2)
      .max(4),
    rows: z
      .array(
        z.object({
          label: text().describe("The attribute, 1–4 words, e.g. 'Cost of a meal'."),
          values: z
            .array(text())
            .describe("Exactly one short value per subject, in the same order as subjects. 1–8 words each."),
          best: z
            .number()
            .int()
            .min(0)
            .nullable()
            .describe("Index of the subject that is clearly better on this row, or null if none is or it's a matter of taste."),
        })
      )
      .min(2)
      .max(10)
      .describe("The attributes that matter most for the user's purpose, most important first."),
    verdict: text()
      .nullable()
      .describe("One sentence: which to pick and when. Null only if it truly depends on taste."),
  })
  // OpenAI's strict mode can't express "same length as subjects", so this is
  // checked here; a mismatched table goes to the invalid-data fallback.
  .superRefine((value, ctx) => {
    value.rows.forEach((row, i) => {
      if (row.values.length !== value.subjects.length) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", i, "values"],
          message: `has ${row.values.length} values for ${value.subjects.length} subjects`,
        })
      }
      if (row.best !== null && row.best >= value.subjects.length) {
        ctx.addIssue({ code: "custom", path: ["rows", i, "best"], message: "points past the last subject" })
      }
    })
  })

export type ComparisonArgs = z.infer<typeof comparisonSchema>

export const comparison = defineWidget({
  name: "show_comparison",
  label: "comparison",
  description: [
    "Show a side-by-side comparison table of 2–4 things across the attributes that matter.",
    "Use when the user asks to compare options or asks which of several things to choose:",
    "'compare Tokyo and Osaka', 'iPhone vs Pixel', 'Postgres or MySQL for my app?'.",
    "Write any explanation as text before it, and put the bottom line in `verdict`.",
    "Do not use for a single subject (use the fact card), or when the differences don't fit short table cells.",
    "Do not use for a question about two things that has a one-line answer ('which is bigger, Tokyo or Osaka?',",
    "'is Postgres older than MySQL?'): answer it in a sentence. A table is for weighing several attributes.",
    "If the user asks you to just pick ('just tell me which'), pick in a sentence: no table.",
  ].join(" "),
  schema: comparisonSchema,
})
