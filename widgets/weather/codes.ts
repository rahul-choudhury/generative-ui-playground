/**
 * WMO weather interpretation codes, as used by Open-Meteo
 * (https://open-meteo.com/en/docs, checked 2026-11-06). One short label per
 * code; `kind` drives the icon. Unknown codes fall back to a neutral label
 * rather than failing.
 */

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm"

const CODES: Record<number, { label: string; kind: WeatherKind }> = {
  0: { label: "Clear", kind: "clear" },
  1: { label: "Mostly clear", kind: "partly" },
  2: { label: "Partly cloudy", kind: "partly" },
  3: { label: "Overcast", kind: "cloudy" },
  45: { label: "Fog", kind: "fog" },
  48: { label: "Freezing fog", kind: "fog" },
  51: { label: "Light drizzle", kind: "drizzle" },
  53: { label: "Drizzle", kind: "drizzle" },
  55: { label: "Heavy drizzle", kind: "drizzle" },
  56: { label: "Freezing drizzle", kind: "drizzle" },
  57: { label: "Heavy freezing drizzle", kind: "drizzle" },
  61: { label: "Light rain", kind: "rain" },
  63: { label: "Rain", kind: "rain" },
  65: { label: "Heavy rain", kind: "rain" },
  66: { label: "Freezing rain", kind: "rain" },
  67: { label: "Heavy freezing rain", kind: "rain" },
  71: { label: "Light snow", kind: "snow" },
  73: { label: "Snow", kind: "snow" },
  75: { label: "Heavy snow", kind: "snow" },
  77: { label: "Snow grains", kind: "snow" },
  80: { label: "Light showers", kind: "rain" },
  81: { label: "Showers", kind: "rain" },
  82: { label: "Violent showers", kind: "rain" },
  85: { label: "Snow showers", kind: "snow" },
  86: { label: "Heavy snow showers", kind: "snow" },
  95: { label: "Thunderstorm", kind: "storm" },
  96: { label: "Thunderstorm with hail", kind: "storm" },
  97: { label: "Heavy thunderstorm", kind: "storm" },
  99: { label: "Thunderstorm with heavy hail", kind: "storm" },
}

export function describeCode(code: number): { label: string; kind: WeatherKind } {
  return CODES[code] ?? { label: "Unknown conditions", kind: "cloudy" }
}
