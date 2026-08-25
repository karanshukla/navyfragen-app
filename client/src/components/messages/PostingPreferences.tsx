import { Box, Switch, Text } from "@mantine/core";

import { useTranslations } from "../../lib/i18n";
import {
  PREFERENCE_KEYS,
  type MessagePreferencesState,
  type PreferenceKey,
} from "../../lib/useMessagePreferences";
import { useNumberFormat } from "../../lib/useNumberFormat";

import { CollapsibleCard } from "./CollapsibleCard";
import * as styles from "./PostingPreferences.styles";

interface PostingPreferencesProps {
  state: MessagePreferencesState;
}

export function PostingPreferences({ state }: PostingPreferencesProps) {
  const { preferences, setPreference, enabledCount } = state;
  const messages = useTranslations();
  const formatNumber = useNumberFormat();
  const copy: Record<PreferenceKey, { label: string; description: string }> =
    messages.postingPreferences;

  return (
    <CollapsibleCard
      title={messages.postingPreferences.title}
      summary={messages.postingPreferences.summary(
        formatNumber(enabledCount),
        formatNumber(PREFERENCE_KEYS.length)
      )}
    >
      {PREFERENCE_KEYS.map((key) => (
        <Box key={key} py="xs" style={styles.row}>
          <Switch
            checked={preferences[key]}
            onChange={(e) => setPreference(key, e.currentTarget.checked)}
            label={
              <Box>
                <Text fw={600} size="sm">
                  {copy[key].label}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {copy[key].description}
                </Text>
              </Box>
            }
          />
        </Box>
      ))}
    </CollapsibleCard>
  );
}
