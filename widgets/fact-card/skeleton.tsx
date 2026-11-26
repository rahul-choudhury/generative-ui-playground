import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import styles from "./fact-card.module.css"

/** Mirrors FactCard: name + descriptor, headline figure, leader rows. */
export function FactCardSkeleton() {
  return (
    <Card className={styles.card}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonName}>
          <Skeleton className={styles.skeletonSubject} />
          <Skeleton className={styles.skeletonDescriptor} />
        </div>
        <Skeleton className={styles.skeletonHeadline} />
      </div>
      <div className={styles.skeletonRows}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonLabel} />
            <Skeleton className={styles.skeletonValue} />
          </div>
        ))}
      </div>
    </Card>
  )
}
