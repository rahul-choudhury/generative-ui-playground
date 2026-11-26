import { Card, Skeleton } from "@rahul-choudhury/ui/components"
import styles from "./checklist.module.css"

/** Shown while the checklist's arguments stream. Mirrors the real layout. */
export function ChecklistSkeleton() {
  return (
    <Card className={styles.card}>
      <div className={styles.skeletonHeader}>
        <Skeleton className={styles.titleSkeleton} />
      </div>
      <div className={styles.skeletonRows}>
        {[72, 56, 64].map((width) => (
          <div key={width} className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonBox} />
            <Skeleton className={styles.skeletonLine} style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}
