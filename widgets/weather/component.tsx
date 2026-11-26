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
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import type { WidgetProps } from "../define"
import { asObject, asString } from "../partial"
import { describeCode, type WeatherKind } from "./codes"
import { formatDay, placeLabel, type WeatherArgs, type WeatherResult } from "./definition"
import styles from "./weather.module.css"

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
      className={`${styles.card} ${styles.container}`}
      role="region"
      aria-label={`Weather for ${placeLabel(place)}`}
    >
      <header className={`${styles.header} ${styles.pad}`}>
        <div className={styles.place}>
          <h3 className={styles.name}>{place.name}</h3>
          <p className={`${styles.small} ${styles.muted}`}>
            {[place.region !== place.name ? place.region : null, place.country].filter(Boolean).join(", ")}
            {localTime && <span className={styles.numbers}> · {localTime} local</span>}
          </p>
        </div>

        <div className={styles.now}>
          <p className={styles.temperatureLine}>
            <WeatherIcon kind={now.kind} night={!current.isDay} size={32} className={styles.nowIcon} />
            <span className={styles.temperature}>
              {Math.round(current.temperature)}
              <span className={styles.unit}>{deg}</span>
            </span>
          </p>
          <p className={`${styles.conditions} ${styles.small}`}>
            {now.label}
            <span className={styles.muted}> · feels {Math.round(current.feelsLike)}°</span>
          </p>
        </div>
      </header>

      <ol className={styles.days}>
        {daily.map((day, i) => {
          const conditions = describeCode(day.code)
          const rain = day.precipitationChance
          return (
            <li key={day.date} className={styles.day}>
              <span className={`${styles.xs} ${styles.muted}`}>
                {i === 0 ? "Today" : formatDay(day.date, "weekday")}
              </span>
              <WeatherIcon kind={conditions.kind} size={22} className={styles.dayIcon} label={conditions.label} />
              <span className={`${styles.small} ${styles.numbers}`}>
                <span className={styles.high}>{Math.round(day.max)}°</span>
                <span className={styles.muted}> {Math.round(day.min)}°</span>
              </span>
              <span
                className={`${styles.rain} ${styles.xs} ${styles.muted} ${styles.numbers}`}
                data-hidden={rain === null || rain < 20 || undefined}
              >
                <DropIcon size={11} weight="fill" aria-hidden />
                <span className="sr-only">Chance of precipitation </span>
                {Math.round(rain ?? 0)}%
              </span>
            </li>
          )
        })}
      </ol>

      <footer className={`${styles.footer} ${styles.pad} ${styles.xs} ${styles.muted}`}>
        <span className={`${styles.wind} ${styles.numbers}`}>
          <WindIcon size={13} aria-hidden />
          Wind {Math.round(current.windSpeed)} {units === "celsius" ? "km/h" : "mph"}
        </span>
        {/* Required by Open-Meteo's CC BY 4.0 licence. */}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className={styles.source}>
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
      className={styles.card}
      aria-busy={!interrupted || undefined}
      aria-label={location ? `Fetching weather for ${location}` : "Fetching weather"}
    >
      <WeatherSkeletonBody title={location} />
    </Card>
  )
}

export function WeatherSkeleton() {
  return (
    <Card className={styles.card}>
      <WeatherSkeletonBody />
    </Card>
  )
}

function WeatherSkeletonBody({ title }: { title?: string }) {
  return (
    <>
      <div className={`${styles.skeletonHeader} ${styles.pad}`}>
        <div className={styles.skeletonPlace}>
          {title ? <h3 className={styles.name}>{title}</h3> : <Skeleton className={styles.skeletonName} />}
          <Skeleton className={styles.skeletonRegion} />
        </div>
        <Skeleton className={styles.skeletonNow} />
      </div>
      <div className={styles.skeletonDays}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonDay}>
            <Skeleton className={styles.skeletonDayName} />
            <Skeleton className={styles.skeletonIcon} />
            <Skeleton className={styles.skeletonTemperature} />
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
