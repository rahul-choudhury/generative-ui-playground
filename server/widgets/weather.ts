/**
 * Fetches live weather for show_weather from Open-Meteo: no API key, free for
 * non-commercial use (10,000 calls/day), CC BY 4.0, so the widget credits it.
 * https://open-meteo.com/en/docs
 *
 * Two requests: place name → coordinates (geocoding), then coordinates →
 * forecast in the place's local time.
 */
import { z } from "zod"
import {
  weatherResultSchema,
  type WeatherArgs,
  type WeatherResult,
} from "../../widgets/weather/definition"
import { ResolveError } from "./resolve-error"

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

// Only the fields we use; anything else Open-Meteo sends is ignored.
const geocodingResponse = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .optional(),
})

const forecastResponse = z.object({
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    is_day: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
  }),
})

type Options = {
  fetch?: typeof fetch
  now?: () => number
  /** How long a result is reused for the same request. */
  ttlMs?: number
  /** Per-request timeout for each Open-Meteo call. */
  timeoutMs?: number
}

export function createWeatherResolver({
  fetch: fetchImpl = fetch,
  now = Date.now,
  ttlMs = 10 * 60_000,
  timeoutMs = 6_000,
}: Options = {}) {
  // Promises are cached, so concurrent identical requests share one fetch.
  const cache = new Map<string, { at: number; value: Promise<WeatherResult> }>()

  async function getJson<T>(url: URL, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) })
    } catch (error) {
      if (signal.aborted) throw error // the user hit Stop: not a weather failure
      throw new ResolveError("The weather service didn't respond. Try again in a moment.")
    }
    if (!response.ok) {
      throw new ResolveError("The weather service didn't respond. Try again in a moment.")
    }
    const parsed = schema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) throw new ResolveError("The weather service sent data this app couldn't read.")
    return parsed.data
  }

  async function fetchWeather(args: WeatherArgs, signal: AbortSignal): Promise<WeatherResult> {
    const geocodeUrl = new URL(GEOCODING_URL)
    geocodeUrl.search = new URLSearchParams({
      name: args.location,
      count: "1", // results are ranked by relevance and population
      language: "en",
      format: "json",
      ...(args.country ? { countryCode: args.country } : {}),
    }).toString()
    const place = (await getJson(geocodeUrl, geocodingResponse, signal)).results?.[0]
    if (!place) {
      const where = args.country ? ` in ${args.country}` : ""
      throw new ResolveError(`Couldn't find a place called “${args.location}”${where}.`)
    }

    const fahrenheit = args.units === "fahrenheit"
    const forecastUrl = new URL(FORECAST_URL)
    forecastUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: String(args.days),
      temperature_unit: fahrenheit ? "fahrenheit" : "celsius",
      wind_speed_unit: fahrenheit ? "mph" : "kmh",
    }).toString()
    const forecast = await getJson(forecastUrl, forecastResponse, signal)

    // Validated against the widget's own result schema, so a mapping bug
    // fails here on the server rather than in the user's browser.
    return weatherResultSchema.parse({
      place: {
        name: place.name,
        region: place.admin1 ?? null,
        country: place.country ?? place.country_code ?? "",
        timezone: forecast.timezone,
      },
      units: args.units,
      current: {
        time: forecast.current.time,
        temperature: forecast.current.temperature_2m,
        feelsLike: forecast.current.apparent_temperature,
        code: forecast.current.weather_code,
        isDay: forecast.current.is_day === 1,
        windSpeed: forecast.current.wind_speed_10m,
      },
      daily: forecast.daily.time.map((date, i) => ({
        date,
        code: forecast.daily.weather_code[i],
        max: forecast.daily.temperature_2m_max[i],
        min: forecast.daily.temperature_2m_min[i],
        precipitationChance: forecast.daily.precipitation_probability_max[i] ?? null,
      })),
    })
  }

  return function resolveWeather(args: WeatherArgs, signal: AbortSignal): Promise<WeatherResult> {
    const key = [args.location.toLowerCase(), args.country ?? "", args.days, args.units].join("|")
    const hit = cache.get(key)
    if (hit && now() - hit.at < ttlMs) return hit.value

    const value = fetchWeather(args, signal)
    cache.set(key, { at: now(), value })
    value.catch(() => cache.delete(key)) // never cache a failure
    return value
  }
}

export const resolveWeather = createWeatherResolver()
