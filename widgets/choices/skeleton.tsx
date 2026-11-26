import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import styles from "./choices.module.css"

/** Mirrors Choices: a question line, then option rows. */
export function ChoicesSkeleton() {
  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <Skeleton className={styles.questionSkeleton} />
      </div>
      <div className={styles.options}>
        {[40, 52, 36].map((width) => (
          <div key={width} className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonBox} />
            <Skeleton className={styles.skeletonLine} style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
