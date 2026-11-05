/**
 * The checklist widget's contract with the model: name, when to use it, and
 * the shape of its arguments. No React here, so the server can import it.
 */
import { z } from "zod"
import { defineWidget, text } from "../define"

export const checklistSchema = z.object({
  title: text().describe("Short heading for the list, e.g. 'Tokyo packing list'."),
  items: z
    .array(
      z.object({
        label: text().describe("One concrete, actionable item. No numbering."),
        checked: z
          .boolean()
          .describe("True only if the user said this item is already done."),
      })
    )
    .min(1),
})

export type ChecklistArgs = z.infer<typeof checklistSchema>

export const checklist = defineWidget({
  name: "show_checklist",
  label: "checklist",
  description: [
    "Show the user an interactive checklist they can tick off.",
    "Use when the answer is a set of discrete things to do, bring, buy or check:",
    "packing lists, todo lists, shopping lists, step-by-step setup tasks, launch checklists.",
    "Do not use for explanations, comparisons, or facts, even if they could be bullet points.",
  ].join(" "),
  schema: checklistSchema,
})
