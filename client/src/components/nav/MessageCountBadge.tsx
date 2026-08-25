import { useTranslations } from "../../lib/i18n";
import { useNumberFormat } from "../../lib/useNumberFormat";

import * as styles from "./MessageCountBadge.styles";

/** Unread count beside the Messages link. */
export function MessageCountBadge({ count }: { count: number }) {
  const messages = useTranslations();
  const formatNumber = useNumberFormat();
  const formatted = formatNumber(count);
  return (
    <span style={styles.badge} aria-label={messages.nav.unreadCount(formatted)}>
      {formatted}
    </span>
  );
}
