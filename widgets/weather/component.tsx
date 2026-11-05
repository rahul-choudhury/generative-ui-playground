import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudMoonIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  DropIcon,
  MoonIcon,
  SunIcon,
  WindIcon,
  type Icon,
} from "@phosphor-icons/react"
import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asObject, asString } from "../partial"
import { describeCode, type WeatherKind } from "./codes"
import { formatDay, placeLabel, type WeatherArgs, type WeatherResult } from "./definition"

/**
 * Live weather in the same language as the fact card: the place set in the
 * serif, the current temperature as the headline figure, and a quiet strip
 * of days. Rain chance only shows when it's worth noticing.
 */
export function Weather({ result }: WidgetProps<WeatherArgs, undefined, WeatherResult>) {
  const { place, current, daily, units } = result
  const now = describeCode(current.code)
  const deg = units === "celsius" ? "°C" : "°F"
  const localTime = current.time.split("T")[1]

  return (
    <Card
      variant="bordered"
      className="@container max-w-xl overflow-hidden"
      role="region"
      aria-label={`Weather for ${placeLabel(place)}`}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="font-serif text-[2rem] leading-tight font-semibold">{place.name}</h3>
          <p className="text-sm text-text-muted">
            {[place.region !== place.name ? place.region : null, place.country].filter(Boolean).join(", ")}
            {localTime && <span className="tabular-nums"> · {localTime} local</span>}
          </p>
        </div>

        <div className="@sm:text-right">
          {/* Icon and temperature share one line, so the icon always sits
              right beside the number, whatever the condition text's width. */}
          <p className="flex items-center gap-2 @sm:justify-end">
            <WeatherIcon kind={now.kind} night={!current.isDay} size={32} className="shrink-0 text-text-secondary" />
            <span className="font-serif text-[2.75rem] leading-none">
              {Math.round(current.temperature)}
              <span className="text-[0.55em] align-top text-text-muted">{deg}</span>
            </span>
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {now.label}
            <span className="text-text-muted"> · feels {Math.round(current.feelsLike)}°</span>
          </p>
        </div>
      </header>

      {/* One column per day; scrolls sideways in a narrow card instead of
          squeezing. */}
      <ol className="flex overflow-x-auto border-t border-border">
        {daily.map((day, i) => {
          const conditions = describeCode(day.code)
          const rain = day.precipitationChance
          return (
            <li
              key={day.date}
              className="flex min-w-[4.75rem] flex-1 flex-col items-center gap-1.5 border-r border-border px-2 py-3 last:border-r-0"
            >
              <span className="text-xs text-text-muted">{i === 0 ? "Today" : formatDay(day.date, "weekday")}</span>
              <WeatherIcon kind={conditions.kind} size={22} className="text-text-secondary" label={conditions.label} />
              <span className="text-sm tabular-nums">
                <span className="font-medium">{Math.round(day.max)}°</span>
                <span className="text-text-muted"> {Math.round(day.min)}°</span>
              </span>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs tabular-nums text-text-muted",
                  // Keep the row height even when there's nothing to show.
                  (rain === null || rain < 20) && "invisible"
                )}
              >
                <DropIcon size={11} weight="fill" aria-hidden />
                <span className="sr-only">Chance of precipitation </span>
                {Math.round(rain ?? 0)}%
              </span>
            </li>
          )
        })}
      </ol>

      <footer className="flex items-center justify-between gap-4 border-t border-border px-5 py-2.5 text-xs text-text-muted sm:px-6">
        <span className="flex items-center gap-1.5 tabular-nums">
          <WindIcon size={13} aria-hidden />
          Wind {Math.round(current.windSpeed)} {units === "celsius" ? "km/h" : "mph"}
        </span>
        {/* Required by Open-Meteo's CC BY 4.0 licence. */}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="hover:text-text-secondary">
          Weather data: Open-Meteo
        </a>
      </footer>
    </Card>
  )
}

/**
 * Before the data arrives (the model's arguments, then the server's fetch):
 * the place name the model asked for, with the rest as placeholders.
 */
export function WeatherPending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const location = asString(asObject(partial).location)
  return (
    <Card
      variant="bordered"
      className="max-w-xl overflow-hidden"
      aria-busy={!interrupted || undefined}
      aria-label={location ? `Fetching weather for ${location}` : "Fetching weather"}
    >
      <WeatherSkeletonBody title={location} />
    </Card>
  )
}

export function WeatherSkeleton() {
  return (
    <Card variant="bordered" className="max-w-xl overflow-hidden">
      <WeatherSkeletonBody />
    </Card>
  )
}

function WeatherSkeletonBody({ title }: { title?: string }) {
  return (
    <>
      <div className="flex items-end justify-between gap-8 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-col gap-2">
          {title ? (
            <h3 className="font-serif text-[2rem] leading-tight font-semibold">{title}</h3>
          ) : (
            <Skeleton className="h-8 w-32" />
          )}
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-11 w-24" />
      </div>
      <div className="flex border-t border-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2 border-r border-border py-3 last:border-r-0">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    </>
  )
}

const ICONS: Record<WeatherKind, { day: Icon; night: Icon }> = {
  clear: { day: SunIcon, night: MoonIcon },
  partly: { day: CloudSunIcon, night: CloudMoonIcon },
  cloudy: { day: CloudIcon, night: CloudIcon },
  fog: { day: CloudFogIcon, night: CloudFogIcon },
  drizzle: { day: CloudRainIcon, night: CloudRainIcon },
  rain: { day: CloudRainIcon, night: CloudRainIcon },
  snow: { day: CloudSnowIcon, night: CloudSnowIcon },
  storm: { day: CloudLightningIcon, night: CloudLightningIcon },
}

function WeatherIcon(props: { kind: WeatherKind; night?: boolean; size: number; className?: string; label?: string }) {
  const IconComponent = ICONS[props.kind][props.night ? "night" : "day"]
  return (
    <IconComponent
      size={props.size}
      className={props.className}
      // Daily icons carry the condition for screen readers; the current one
      // is already spelled out next to it.
      {...(props.label ? { "aria-label": props.label, role: "img" } : { "aria-hidden": true })}
    />
  )
}
