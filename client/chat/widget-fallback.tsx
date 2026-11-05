import { WarningCircleIcon } from "@phosphor-icons/react"

type FallbackProps =
  | { kind: "unknown"; name: string; args: unknown }
  | { kind: "invalid"; label: string; issues: string[]; args: unknown }
  | { kind: "crashed"; label: string; error: Error; args: unknown }

/**
 * Shown in place of a widget that can't be displayed. Quiet by design: a
 * short human message, with the technical reason one click away under
 * "Details" (this is a playground, so the why is worth seeing).
 */
export function WidgetFallback(props: FallbackProps) {
  const { title, description } = copy(props)

  return (
    <div role="status" className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex gap-2.5">
        <WarningCircleIcon size={18} className="mt-px shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-text-muted">{description}</p>

          <details className="group mt-2">
            <summary className="w-fit cursor-pointer text-xs text-text-muted select-none hover:text-text-secondary">
              Details
            </summary>
            <div className="mt-2 flex flex-col gap-2 text-xs">
              {props.kind === "invalid" && (
                <ul className="flex flex-col gap-0.5">
                  {props.issues.map((issue) => (
                    <li key={issue} className="font-mono text-text-secondary">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
              {props.kind === "crashed" && (
                <p className="font-mono text-text-secondary">{props.error.message}</p>
              )}
              <pre className="max-h-48 overflow-auto rounded-sm bg-surface-soft p-2 font-mono text-[11px] leading-relaxed text-text-secondary">
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
  }
}

/**
 * Not an error: the reply stopped before the widget finished. When part of
 * it is shown above, say it's incomplete; otherwise that nothing arrived.
 */
export function WidgetInterrupted({ label, partial }: { label: string; partial: boolean }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-text-muted">
      {partial
        ? `The ${label} above is incomplete: the reply stopped before it finished.`
        : `The ${label} was interrupted before it finished.`}
    </p>
  )
}
