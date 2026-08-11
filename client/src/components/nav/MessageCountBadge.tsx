import * as styles from "./MessageCountBadge.styles";

/** Unread count beside the Messages link. */
export function MessageCountBadge({ count }: { count: number }) {
  return (
    <span style={styles.badge} aria-label={`${count} unread`}>
      {count}
    </span>
  );
}
