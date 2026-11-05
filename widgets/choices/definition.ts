import { z } from "zod"
import { defineWidget, text } from "../define"

export const choicesSchema = z.object({
  question: text().describe("The question, short and direct, e.g. 'What kind of trip are you planning?'."),
  options: z
    .array(
      z.object({
        label: text().describe("The answer as the user would say it, 1–5 words, e.g. 'City break'."),
        description: text()
          .nullable()
          .describe("One short line on what picking this means, or null if the label says it all."),
      })
    )
    .min(2)
    .max(4)
    .describe("2–4 distinct, mutually exclusive options. No 'Other': the user can always type instead."),
})

export type ChoicesArgs = z.infer<typeof choicesSchema>

/** Index of the picked option, or null before the user picks. */
export const choicesStateSchema = z.object({ picked: z.number().int().nonnegative().nullable() })
export type ChoicesState = z.infer<typeof choicesStateSchema>

export const choices = defineWidget({
  name: "show_choices",
  label: "choice",
  description: [
    "Ask the user to pick one of 2–4 options, shown as buttons; their pick comes back as their next message.",
    "Use only when the request is ambiguous in a way that changes your answer and only the user can resolve it:",
    "e.g. 'plan a trip' (what kind?), 'pick a laptop' (main use?).",
    "Do not use when a sensible default exists (just state your assumption and answer),",
    "for yes/no questions, or to offer next steps after an answer.",
    "Ask at most ONE question before giving a real answer: once the user has answered one,",
    "answer with what you know and state any remaining assumptions instead of asking again.",
    "If a 'No preference' or 'Not sure' option would make sense, that's a sign a default exists: don't ask.",
    "Do not also list the options in text.",
  ].join(" "),
  schema: choicesSchema,
  state: {
    schema: choicesStateSchema,
    initial: () => ({ picked: null }),
    describeChange: (args, before, after) => {
      if (after.picked === null || after.picked === before.picked) return null
      const option = args.options[after.picked]
      if (!option) return null // out of range: say nothing rather than something wrong
      return `In the choice "${args.question}": picked "${option.label}".`
    },
  },
})
