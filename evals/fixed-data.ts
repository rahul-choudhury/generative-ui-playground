/**
 * Fixed data for data widgets during evals, so answers can be checked
 * against exact figures instead of whatever the live forecast says today.
 *
 * "Now" is Thursday 5 Nov 2026, 21:00 local, the case that exposed the
 * wrong-day bug: today (Thu) is 37% rain, tomorrow (Fri) is 18% drizzle,
 * the day after (Sat) is 10% overcast. An answer quoting the wrong day's
 * figure is easy to spot.
 */
import type { DataSource } from "../server/llm/stream"
import type { ToolResult } from "../shared/protocol"
import { validateWidget } from "../widgets/validate"
import type { WeatherArgs, WeatherResult } from "../widgets/weather/definition"

export const NOT_A_PLACE = "Qwxzvaltrop"

/** One week from Thu 5 Nov: [weather code, max, min, % chance of precipitation]. */
const WEEK: [number, number, number, number][] = [
  [3, 11, 9, 37], // Thu: overcast (today)
  [51, 12, 9, 18], // Fri: light drizzle (tomorrow)
  [3, 10, 6, 10], // Sat: overcast
  [63, 9, 5, 70], // Sun: rain
  [0, 8, 2, 0], // Mon: clear
  [2, 9, 3, 5], // Tue: partly cloudy
  [80, 10, 5, 60], // Wed: showers
]

const PLACES: Record<string, Omit<WeatherResult["place"], "name"> & { offset: number }> = {
  london: { region: "England", country: "United Kingdom", timezone: "Europe/London", offset: 0 },
  oslo: { region: "Oslo", country: "Norway", timezone: "Europe/Oslo", offset: -8 },
  chicago: { region: "Illinois", country: "United States", timezone: "America/Chicago", offset: -2 },
  lisbon: { region: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon", offset: 6 },
}

function weatherFor(args: WeatherArgs): WeatherResult {
  const key = args.location.toLowerCase()
  const known = PLACES[key]
  const place =
    key === "portland" && args.country === "GB"
      ? { region: "England", country: "United Kingdom", timezone: "Europe/London", offset: 0 }
      : (known ?? { region: null, country: args.country ?? "Unknown", timezone: "UTC", offset: 3 })

  // Celsius figures, shifted per place so places differ; converted if asked.
  const temp = (c: number) => (args.units === "fahrenheit" ? Math.round((c * 9) / 5 + 32) : c)

  return {
    place: { name: args.location, region: place.region, country: place.country, timezone: place.timezone },
    units: args.units,
    current: {
      time: "2026-11-05T21:00",
      temperature: temp(10 + place.offset),
      feelsLike: temp(8 + place.offset),
      code: 3,
      isDay: false,
      windSpeed: args.units === "fahrenheit" ? 5 : 8,
    },
    daily: WEEK.slice(0, args.days).map(([code, max, min, rain], i) => ({
      date: `2026-11-${String(5 + i).padStart(2, "0")}`,
      code,
      max: temp(max + place.offset),
      min: temp(min + place.offset),
      precipitationChance: rain,
    })),
  }
}

export const fixedData: DataSource = {
  hasResolver: (name) => name === "show_weather",
  async resolveWidget(name, args): Promise<ToolResult> {
    const validated = validateWidget(name, args)
    if (name !== "show_weather" || validated.status !== "ok") {
      return { status: "error", message: "The request for this widget was invalid." }
    }
    const weatherArgs = validated.data as WeatherArgs
    if (weatherArgs.location.toLowerCase() === NOT_A_PLACE.toLowerCase()) {
      return { status: "error", message: `Couldn't find a place called “${weatherArgs.location}”.` }
    }
    return { status: "ok", data: weatherFor(weatherArgs) }
  },
}
