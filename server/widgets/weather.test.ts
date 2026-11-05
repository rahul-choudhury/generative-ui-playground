import { describe, expect, test } from "bun:test"
import type { WeatherArgs } from "../../widgets/weather/definition"
import { ResolveError } from "./resolve-error"
import { createWeatherResolver } from "./weather"

const args: WeatherArgs = { location: "Oslo", country: null, days: 2, units: "celsius" }

const geocodeOslo = {
  results: [
    {
      name: "Oslo",
      latitude: 59.91,
      longitude: 10.75,
      admin1: "Oslo",
      country: "Norway",
      country_code: "NO",
      timezone: "Europe/Oslo",
    },
  ],
}
const forecastOslo = {
  timezone: "Europe/Oslo",
  current: {
    time: "2026-11-05T21:45",
    temperature_2m: 3.1,
    apparent_temperature: 0.2,
    weather_code: 0,
    wind_speed_10m: 6.1,
    is_day: 0,
  },
  daily: {
    time: ["2026-11-05", "2026-11-06"],
    weather_code: [2, 61],
    temperature_2m_max: [5.9, 5],
    temperature_2m_min: [1.6, 0.7],
    precipitation_probability_max: [0, 80],
  },
}

/** A fake fetch that answers by URL host and records every request. */
function fakeFetch(responses: { geocode?: unknown; forecast?: unknown; fail?: "network" | "status" }) {
  const requests: URL[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push(url)
    if (responses.fail === "network") throw new TypeError("fetch failed")
    if (responses.fail === "status") return new Response("nope", { status: 503 })
    const body = url.host.startsWith("geocoding") ? responses.geocode : responses.forecast
    return Response.json(body)
  }) as typeof fetch
  return { impl, requests }
}

const signal = () => new AbortController().signal

describe("weather resolver", () => {
  test("geocodes, then fetches the forecast, mapped to the result schema", async () => {
    const { impl, requests } = fakeFetch({ geocode: geocodeOslo, forecast: forecastOslo })
    const result = await createWeatherResolver({ fetch: impl })(args, signal())

    expect(result.place).toEqual({ name: "Oslo", region: "Oslo", country: "Norway", timezone: "Europe/Oslo" })
    expect(result.current).toEqual({
      time: "2026-11-05T21:45",
      temperature: 3.1,
      feelsLike: 0.2,
      code: 0,
      isDay: false,
      windSpeed: 6.1,
    })
    expect(result.daily[1]).toEqual({ date: "2026-11-06", code: 61, max: 5, min: 0.7, precipitationChance: 80 })

    expect(requests.map((u) => u.host)).toEqual(["geocoding-api.open-meteo.com", "api.open-meteo.com"])
    expect(requests[1]!.searchParams.get("forecast_days")).toBe("2")
    expect(requests[1]!.searchParams.get("latitude")).toBe("59.91")
  })

  test("passes the country filter and the unit choice through", async () => {
    const { impl, requests } = fakeFetch({ geocode: geocodeOslo, forecast: forecastOslo })
    await createWeatherResolver({ fetch: impl })({ ...args, country: "GB", units: "fahrenheit" }, signal())
    expect(requests[0]!.searchParams.get("countryCode")).toBe("GB")
    expect(requests[1]!.searchParams.get("temperature_unit")).toBe("fahrenheit")
    expect(requests[1]!.searchParams.get("wind_speed_unit")).toBe("mph")
  })

  test("an unknown place is a user-facing error", async () => {
    const { impl } = fakeFetch({ geocode: { generationtime_ms: 0.1 } }) // what Open-Meteo really returns
    const resolve = createWeatherResolver({ fetch: impl })
    const error = await resolve({ ...args, location: "Atlantis" }, signal()).catch((e) => e)
    expect(error).toBeInstanceOf(ResolveError)
    expect(error.message).toBe("Couldn't find a place called “Atlantis”.")
  })

  test("network failures and bad statuses are user-facing errors", async () => {
    for (const fail of ["network", "status"] as const) {
      const { impl } = fakeFetch({ fail })
      const error = await createWeatherResolver({ fetch: impl })(args, signal()).catch((e) => e)
      expect(error).toBeInstanceOf(ResolveError)
      expect(error.message).toContain("didn't respond")
    }
  })

  test("a user abort is not turned into a weather error", async () => {
    const controller = new AbortController()
    controller.abort()
    const impl = (async (_: unknown, init?: RequestInit) => {
      init?.signal?.throwIfAborted()
      return Response.json(geocodeOslo)
    }) as typeof fetch
    const error = await createWeatherResolver({ fetch: impl })(args, controller.signal).catch((e) => e)
    expect(error).not.toBeInstanceOf(ResolveError)
  })

  test("repeat requests within the TTL reuse the result; after it, refetch", async () => {
    let clock = 0
    const { impl, requests } = fakeFetch({ geocode: geocodeOslo, forecast: forecastOslo })
    const resolve = createWeatherResolver({ fetch: impl, now: () => clock, ttlMs: 1000 })

    await resolve(args, signal())
    await resolve({ ...args, location: "OSLO" }, signal()) // same place, different case
    expect(requests).toHaveLength(2) // one geocode + one forecast

    clock = 1500
    await resolve(args, signal())
    expect(requests).toHaveLength(4)
  })

  test("failures are not cached", async () => {
    let fail = true
    const impl = (async (input: string | URL) => {
      if (fail) throw new TypeError("fetch failed")
      const url = new URL(input)
      return Response.json(url.host.startsWith("geocoding") ? geocodeOslo : forecastOslo)
    }) as typeof fetch
    const resolve = createWeatherResolver({ fetch: impl })
    await resolve(args, signal()).catch(() => {})
    fail = false
    expect((await resolve(args, signal())).place.name).toBe("Oslo")
  })
})
