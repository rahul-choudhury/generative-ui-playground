import { WarningCircleIcon } from "@phosphor-icons/react"
import styles from "./widget-fallback.module.css"

type FallbackProps =
  | { kind: "unknown"; name: string; args: unknown }
  | { kind: "invalid"; label: string; issues: string[]; args: unknown }
  | { kind: "crashed"; label: string; error: Error; args: unknown }
  /** A data widget whose fetch failed; `message` is already user-facing. */
  | { kind: "failed"; label: string; message: string; args: unknown }

/**
 * Shown in place of a widget that can't be displayed. Quiet by design: a
 * short human message, with the technical reason one click away under
 * "Details" (this is a playground, so the why is worth seeing).
 */
export function WidgetFallback(props: FallbackProps) {
  const { title, description } = copy(props)

  return (
    <div role="status" className={styles.root}>
      <div className={styles.layout}>
        <WarningCircleIcon size={18} className={styles.icon} aria-hidden />
        <div className={styles.body}>
          <p className={styles.title}>{title}</p>
          <p className={styles.description}>{description}</p>

          <details className={styles.details}>
            <summary className={styles.summary}>
              Details
            </summary>
            <div className={styles.detailsBody}>
              {props.kind === "invalid" && (
                <ul className={styles.issues}>
                  {props.issues.map((issue) => (
                    <li key={issue} className={styles.code}>
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
              {props.kind === "crashed" && (
                <p className={styles.code}>{props.error.message}</p>
              )}
              <pre className={styles.args}>
                {JSON.stringify(props.args, null, 2) ?? "undefined"}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

function copy(props: FallbackProps) {
  switch (props.kind) {
    case "unknown":
      return {
        title: "Can't show this widget",
        description: `The reply asked for a “${props.name}” widget, which this app doesn't have.`,
      }
    case "invalid":
      return {
        title: `Couldn't show the ${props.label}`,
        description: "The assistant sent incomplete or malformed data for it.",
      }
    case "crashed":
      return {
        title: `The ${props.label} ran into an error`,
        description: "Something went wrong while displaying it.",
      }
    case "failed":
      return { title: `Couldn't load the ${props.label}`, description: props.message }
  }
}

/**
 * Not an error: the reply stopped before the widget finished. When part of
 * it is shown above, say it's incomplete; otherwise that nothing arrived.
 */
export function WidgetInterrupted({ label, partial }: { label: string; partial: boolean }) {
  return (
    <p className={styles.interrupted}>
      {partial
        ? `The ${label} above is incomplete: the reply stopped before it finished.`
        : `The ${label} was interrupted before it finished.`}
    </p>
  )
}
