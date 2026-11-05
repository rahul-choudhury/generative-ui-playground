import { ClockIcon, UsersIcon } from "@phosphor-icons/react"
import { cn } from "@rahul-choudhury/ui"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import { useState } from "react"
import type { WidgetProps } from "../define"
import { asArray, asNumber, asObject, asString } from "../partial"
import type { RecipeArgs, RecipeResult } from "./definition"

/**
 * A recipe card in the same voice as the fact card: the dish in the serif
 * with an italic line, then ingredients and method side by side when there's
 * room. The photo (fetched by the server) fades in above when found; without
 * one the card simply starts at the title.
 */
export function Recipe({
  args,
  result,
  resultLoading,
}: WidgetProps<RecipeArgs, undefined, RecipeResult | undefined>) {
  return <RecipeLayout {...args} image={result?.image ?? null} imageLoading={resultLoading} />
}

export function RecipePending({ partial, interrupted = false }: { partial: unknown; interrupted?: boolean }) {
  const args = asObject(partial)
  return (
    <RecipeLayout
      dish={asString(args.dish) ?? ""}
      summary={asString(args.summary) ?? null}
      servings={asNumber(args.servings) ?? null}
      totalTime={asString(args.totalTime) ?? null}
      ingredients={asArray(args.ingredients)
        .map(asObject)
        .filter((i) => Boolean(asString(i.item)))
        .map((i) => ({ quantity: asString(i.quantity) ?? null, item: i.item as string }))}
      steps={asArray(args.steps).flatMap((s) => (asString(s) ? [s as string] : []))}
      tip={asString(args.tip) ?? null}
      image={null}
      imageLoading={!interrupted}
      pending={!interrupted}
    />
  )
}

type LayoutProps = RecipeArgs & {
  image: NonNullable<RecipeResult["image"]> | null
  imageLoading: boolean
  pending?: boolean
}

function RecipeLayout(props: LayoutProps) {
  const { dish, summary, servings, totalTime, ingredients, steps, tip, image, imageLoading, pending = false } = props
  const enter = cn(pending && "motion-safe:animate-row-in")

  return (
    <Card
      variant="bordered"
      className="@container overflow-hidden"
      role="region"
      aria-label={dish ? `Recipe: ${dish}` : "Recipe"}
      aria-busy={pending || undefined}
    >
      {imageLoading ? <Skeleton className="aspect-[5/2] w-full rounded-none" /> : image && <Photo image={image} dish={dish} />}

      <header className="px-5 pt-5 sm:px-6">
        {dish ? (
          <h3 className="font-serif text-[2rem] leading-tight font-semibold">{dish}</h3>
        ) : (
          <Skeleton className="h-8 w-40" />
        )}
        {summary && <p className="font-serif text-lg leading-snug text-text-muted italic">{summary}</p>}
        {(servings || totalTime) && (
          <p className="mt-2 flex gap-4 text-sm text-text-secondary">
            {servings && (
              <span className="flex items-center gap-1.5">
                <UsersIcon size={14} aria-hidden /> Serves {servings}
              </span>
            )}
            {totalTime && (
              <span className="flex items-center gap-1.5">
                <ClockIcon size={14} aria-hidden /> {totalTime}
              </span>
            )}
          </p>
        )}
      </header>

      {/* Side by side when the card is wide enough, stacked otherwise. */}
      <div className="mt-5 grid border-t border-border @lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="px-5 py-4 sm:px-6 @lg:border-r @lg:border-border">
          <h4 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Ingredients</h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {ingredients.map((ingredient, i) => (
              <li key={i} className={cn("flex gap-3", enter)}>
                <span className="w-16 shrink-0 text-right text-text-muted tabular-nums">{ingredient.quantity}</span>
                <span>{ingredient.item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border px-5 py-4 sm:px-6 @lg:border-t-0">
          <h4 className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Method</h4>
          <ol className="flex flex-col gap-3 text-sm leading-6">
            {steps.map((step, i) => (
              <li key={i} className={cn("flex gap-3", enter)}>
                <span className="w-4 shrink-0 font-serif text-base leading-6 text-text-muted tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {tip && (
        <p className={cn("border-t border-border px-5 py-3.5 font-serif text-[1.05rem] leading-snug sm:px-6", enter)}>
          <span className="font-sans text-xs font-medium tracking-wide text-text-muted uppercase">Tip · </span>
          {tip}
        </p>
      )}
    </Card>
  )
}

/** The dish photo with the attribution its licence requires. */
function Photo({ image, dish }: { image: NonNullable<RecipeResult["image"]>; dish: string }) {
  const [loaded, setLoaded] = useState(false)
  const { credit } = image
  return (
    <figure className="relative">
      <img
        src={image.url}
        alt={`${dish}, from the Wikipedia article “${image.article.title}”`}
        width={image.width}
        height={image.height}
        onLoad={() => setLoaded(true)}
        className={cn(
          "aspect-[5/2] w-full bg-surface-soft object-cover transition-opacity duration-(--duration-slow) motion-reduce:transition-none",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
      <figcaption className="absolute right-2 bottom-2 max-w-[80%] truncate rounded-sm bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
        Photo:{" "}
        <a href={credit.fileUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {credit.author ?? "Wikimedia Commons"}
        </a>
        {credit.license && (
          <>
            {" · "}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {credit.license}
              </a>
            ) : (
              credit.license
            )}
          </>
        )}
      </figcaption>
    </figure>
  )
}

export function RecipeSkeleton() {
  return (
    <Card variant="bordered" className="overflow-hidden">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="flex flex-col gap-2.5 border-t border-border px-5 py-4 sm:px-6">
        {[50, 64, 40].map((width) => (
          <Skeleton key={width} className="h-3.5" style={{ width: `${width}%` }} />
        ))}
      </div>
    </Card>
  )
}
