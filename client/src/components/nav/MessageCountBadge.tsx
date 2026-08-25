import { useTranslations } from "../../lib/i18n";

import * as styles from "./MessageCountBadge.styles";

/** Unread count beside the Messages link. */
export function MessageCountBadge({ count }: { count: number }) {
  const messages = useTranslations();
  return (
    <span style={styles.badge} aria-label={messages.nav.unreadCount(count)}>
      {count}
    </span>
  );
}
