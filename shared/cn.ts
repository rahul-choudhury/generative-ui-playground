/**
 * TEMPORARY while the app moves to CSS Modules: joins the truthy class names.
 * Stands in for the library's `cn`, which 0.6 removed.
 */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
