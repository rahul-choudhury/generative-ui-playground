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

/** Which items are ticked, by index. Starts from the model's `checked` flags. */
export const checklistStateSchema = z.array(z.boolean())
export type ChecklistState = z.infer<typeof checklistStateSchema>

/**
 * e.g. In the checklist "Oslo packing list": ticked "Passport" and "Charger";
 * unticked "Umbrella". Now 2 of 10 done.
 */
function describeChecklistChange(args: ChecklistArgs, before: ChecklistState, after: ChecklistState) {
  // A snapshot that doesn't match the list (shouldn't happen) says nothing
  // rather than something wrong.
  if (before.length !== args.items.length || after.length !== args.items.length) return null

  const quote = (i: number) => `"${args.items[i]!.label}"`
  const ticked = after.flatMap((on, i) => (on && !before[i] ? [quote(i)] : []))
  const unticked = after.flatMap((on, i) => (!on && before[i] ? [quote(i)] : []))
  if (ticked.length === 0 && unticked.length === 0) return null

  const changes = [
    ticked.length > 0 && `ticked ${joinList(ticked)}`,
    unticked.length > 0 && `unticked ${joinList(unticked)}`,
  ].filter(Boolean)
  const done = after.filter(Boolean).length
  return `In the checklist "${args.title}": ${changes.join("; ")}. Now ${done} of ${args.items.length} done.`
}

/** a / a and b / a, b and c */
function joinList(items: string[]) {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

export const checklist = defineWidget({
  name: "show_checklist",
  label: "checklist",
  description: [
    "Show the user an interactive checklist they can tick off.",
    "Use when the answer is a set of discrete things to do, bring, buy or check:",
    "packing lists, todo lists, shopping lists, step-by-step setup tasks, launch checklists.",
    "If the user asks for a checklist or a list of things to do or pack, always use this tool,",
    "even if they also want advice: write the advice as text first, then call it.",
    "Never write the checklist as Markdown bullets instead, and keep the advice to a short paragraph",
    "with no list of its own: the actionable items belong in the checklist.",
    "Do not use for explanations, comparisons, or facts, even if they could be bullet points.",
  ].join(" "),
  schema: checklistSchema,
  state: {
    schema: checklistStateSchema,
    initial: (args) => args.items.map((item) => item.checked),
    describeChange: describeChecklistChange,
  },
})
