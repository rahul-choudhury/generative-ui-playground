import { z } from "zod"
import { defineWidget, text } from "../define"

// ─── What the model sends: the recipe itself ────────────────────────────────

export const recipeSchema = z.object({
  dish: text().describe("The dish's common name, as on Wikipedia where possible, e.g. 'Pad thai', 'Shakshouka'. Used to find a photo."),
  summary: text().nullable().describe("One line on what it is or why it works, or null."),
  servings: z.number().int().min(1).max(24).nullable().describe("How many it serves, or null."),
  totalTime: text().nullable().describe("Total time, e.g. '35 min', '1 h 20 min', or null."),
  ingredients: z
    .array(
      z.object({
        quantity: text().nullable().describe("Amount and unit, e.g. '200 g', '2 tbsp', '1'. Null for 'to taste'."),
        item: text().describe("The ingredient, with any prep, e.g. 'rice noodles, soaked'."),
      })
    )
    .min(1)
    .max(30),
  steps: z.array(text().describe("One step, one or two sentences.")).min(1).max(15),
  tip: text().nullable().describe("One practical tip, or null."),
})

export type RecipeArgs = z.infer<typeof recipeSchema>

// ─── What the server fetches: a photo of the dish ───────────────────────────

export const recipeResultSchema = z.object({
  /** Null when no suitable photo was found; the card works without one. */
  image: z
    .object({
      url: z.string().url(),
      width: z.number(),
      height: z.number(),
      /** The Wikipedia article the photo illustrates. */
      article: z.object({ title: z.string(), url: z.string().url() }),
      /** Attribution, as the photo's licence requires. */
      credit: z.object({
        author: z.string().nullable(),
        license: z.string().nullable(),
        licenseUrl: z.string().url().nullable(),
        fileUrl: z.string().url(),
      }),
    })
    .nullable(),
})

export type RecipeResult = z.infer<typeof recipeResultSchema>

export const recipe = defineWidget({
  name: "show_recipe",
  label: "recipe",
  description: [
    "Show a recipe card: ingredients with quantities, numbered steps, and a photo of the dish the app finds.",
    "Use when the user asks how to make or cook a dish, or for a recipe.",
    "Write the whole recipe in the arguments; don't repeat it as text.",
    "Not for food facts or history ('where is pad thai from?': answer in text), restaurant tips,",
    "or a list of dish ideas (answer in text, then offer a recipe for one).",
  ].join(" "),
  schema: recipeSchema,
  result: {
    schema: recipeResultSchema,
    summarize: (args, data) =>
      data.image
        ? `Shown to the user, with a photo from the Wikipedia article "${data.image.article.title}".`
        : `Shown to the user (no photo of ${args.dish} was found).`,
    // The card shows straight away and the photo fades in when found.
    progressive: true,
    // The photo is decoration: the model already wrote the recipe, so no
    // second pass (and no second request's cost).
    continueAfter: false,
  },
})
