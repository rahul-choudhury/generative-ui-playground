import { z } from "zod"
import { defineWidget, text } from "../define"
import { describeCode } from "./codes"

// ─── What the model sends: intent only ──────────────────────────────────────

export const weatherSchema = z.object({
  location: text().describe("The place as the user named it: a city or town, e.g. 'Oslo', 'Portland'."),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .describe("ISO 3166-1 alpha-2 code if the user made the country clear, e.g. 'GB' for Portland, England. Otherwise null."),
  days: z
    .number()
    .int()
    .min(1)
    .max(7)
    .describe("Days of forecast including today. 3, unless they ask about a specific day further out (max 7)."),
  units: z
    .enum(["celsius", "fahrenheit"])
    .describe("'fahrenheit' only if the user asks for it or is clearly in the US; otherwise 'celsius'."),
})

export type WeatherArgs = z.infer<typeof weatherSchema>

// ─── What the server fetches: facts ─────────────────────────────────────────

export const weatherResultSchema = z.object({
  place: z.object({
    name: z.string(),
    /** State/province/region, when the geocoder has one. */
    region: z.string().nullable(),
    country: z.string(),
    timezone: z.string(),
  }),
  units: z.enum(["celsius", "fahrenheit"]),
  current: z.object({
    /** Local time at the place, ISO without offset, e.g. "2026-11-05T21:45". */
    time: z.string(),
    temperature: z.number(),
    feelsLike: z.number(),
    code: z.number().int(),
    isDay: z.boolean(),
    /** km/h for celsius, mph for fahrenheit. */
    windSpeed: z.number(),
  }),
  daily: z
    .array(
      z.object({
        /** Local date, "YYYY-MM-DD". */
        date: z.string(),
        code: z.number().int(),
        max: z.number(),
        min: z.number(),
        /** 0–100, or null when the model has no probability for that day. */
        precipitationChance: z.number().nullable(),
      })
    )
    .min(1),
})

export type WeatherResult = z.infer<typeof weatherResultSchema>

/** "Thu 5 Nov" from "2026-11-05", without timezone drift. */
export function formatDay(date: string, style: "short" | "weekday" = "short") {
  const [y, m, d] = date.split("-").map(Number)
  const utc = new Date(Date.UTC(y!, m! - 1, d!))
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    ...(style === "short" ? { day: "numeric", month: "short" } : {}),
    timeZone: "UTC",
  }).format(utc)
}

export const placeLabel = (place: WeatherResult["place"]) =>
  [place.name, place.region !== place.name ? place.region : null, place.country].filter(Boolean).join(", ")

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
function daysBetween(from: string, to: string) {
  const utc = (date: string) => {
    const [y, m, d] = date.split("-").map(Number)
    return Date.UTC(y!, m! - 1, d!)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/**
 * What the model is told was shown. Compact, but every figure it might cite,
 * and the place's own local date: without it the model can't tell which day
 * is "today" (it was observed answering "tomorrow" with today's forecast).
 */
function summarizeWeather(_args: WeatherArgs, data: WeatherResult) {
  const deg = data.units === "celsius" ? "°C" : "°F"
  const wind = data.units === "celsius" ? "km/h" : "mph"
  const round = Math.round
  const now = data.current
  const [today = "", time = ""] = now.time.split("T")
  const relative = (date: string) => ({ 0: " (today)", 1: " (tomorrow)" })[daysBetween(today, date)] ?? ""

  const lines = [
    `Shown to the user: live weather for ${placeLabel(data.place)}.`,
    `Local date and time there: ${formatDay(today)}, ${time} (${data.place.timezone}).`,
    `Now: ${round(now.temperature)}${deg}, feels like ${round(now.feelsLike)}${deg}, ${describeCode(now.code).label.toLowerCase()}, wind ${round(now.windSpeed)} ${wind}.`,
    ...data.daily.map((day) => {
      const rain = day.precipitationChance === null ? "" : `, ${round(day.precipitationChance)}% chance of precipitation`
      return `${formatDay(day.date)}${relative(day.date)}: ${describeCode(day.code).label.toLowerCase()}, ${round(day.min)} to ${round(day.max)}${deg}${rain}.`
    }),
    `Only these ${data.daily.length} day(s) were fetched. For other days, show the weather again with more days.`,
    "Source: Open-Meteo. Use only these figures; don't invent others.",
    // Read right before the second pass, where evals showed the model
    // answering "what should I pack?" in prose instead of with a checklist.
    "If the user asked what to pack or wear, or for a list, show it now as a checklist based on these figures.",
  ]
  return lines.join("\n")
}

export const weather = defineWidget({
  name: "show_weather",
  label: "weather card",
  description: [
    "Show live current weather and a short daily forecast for one place. The app fetches real data;",
    "you only name the place. Use whenever the user asks about weather, temperature, rain or snow somewhere,",
    "or needs it to decide something (what to wear, whether to bring an umbrella).",
    "After the card is shown you receive the actual figures and continue your reply: answer their",
    "question from those figures in a sentence or two, without repeating the whole card.",
    "If their request also needs another widget (e.g. 'what should I pack?' needs a packing checklist),",
    "call it then, using the figures.",
    "Never state weather figures you weren't given.",
  ].join(" "),
  schema: weatherSchema,
  result: {
    schema: weatherResultSchema,
    summarize: summarizeWeather,
  },
})
