import { ClockIcon, UsersIcon } from "@phosphor-icons/react"
import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import { useState } from "react"
import type { WidgetProps } from "../define"
import { asArray, asNumber, asObject, asString } from "../partial"
import type { RecipeArgs, RecipeResult } from "./definition"
import styles from "./recipe.module.css"

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

  return (
    <Card
      className={styles.card}
      data-pending={pending || undefined}
      role="region"
      aria-label={dish ? `Recipe: ${dish}` : "Recipe"}
      aria-busy={pending || undefined}
    >
      {imageLoading ? <Skeleton className={styles.photoSkeleton} /> : image && <Photo image={image} dish={dish} />}

      <header className={styles.header}>
        {dish ? <h3 className={styles.dish}>{dish}</h3> : <Skeleton className={styles.dishSkeleton} />}
        {summary && <p className={styles.summary}>{summary}</p>}
        {(servings || totalTime) && (
          <p className={styles.meta}>
            {servings && (
              <span className={styles.metaItem}>
                <UsersIcon size={14} aria-hidden /> Serves {servings}
              </span>
            )}
            {totalTime && (
              <span className={styles.metaItem}>
                <ClockIcon size={14} aria-hidden /> {totalTime}
              </span>
            )}
          </p>
        )}
      </header>

      <div className={styles.columns}>
        <section className={`${styles.section} ${styles.ingredients}`}>
          <h4 className={`${styles.label} ${styles.sectionLabel}`}>Ingredients</h4>
          <ul className={styles.ingredientList}>
            {ingredients.map((ingredient, i) => (
              <li key={i} className={`${styles.item} ${styles.enter}`}>
                <span className={styles.quantity}>{ingredient.quantity}</span>
                <span>{ingredient.item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${styles.section} ${styles.method}`}>
          <h4 className={`${styles.label} ${styles.sectionLabel}`}>Method</h4>
          <ol className={styles.stepList}>
            {steps.map((step, i) => (
              <li key={i} className={`${styles.item} ${styles.enter}`}>
                <span className={styles.number}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {tip && (
        <p className={`${styles.tip} ${styles.enter}`}>
          <span className={`${styles.label} ${styles.tipLabel}`}>Tip · </span>
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
    <figure className={styles.figure}>
      <img
        src={image.url}
        alt={`${dish}, from the Wikipedia article “${image.article.title}”`}
        width={image.width}
        height={image.height}
        onLoad={() => setLoaded(true)}
        className={styles.photo}
        data-loaded={loaded || undefined}
      />
      <figcaption className={styles.credit}>
        Photo:{" "}
        <a href={credit.fileUrl} target="_blank" rel="noreferrer">
          {credit.author ?? "Wikimedia Commons"}
        </a>
        {credit.license && (
          <>
            {" · "}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
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
    <Card className={styles.card}>
      <div className={styles.skeletonHeader}>
        <Skeleton className={styles.dishSkeleton} />
        <Skeleton className={styles.skeletonSummary} />
      </div>
      <div className={styles.skeletonLines}>
        {[50, 64, 40].map((width) => (
          <Skeleton key={width} className={styles.skeletonLine} style={{ width: `${width}%` }} />
        ))}
      </div>
    </Card>
  )
}
