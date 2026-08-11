import { Box, Switch, Text } from "@mantine/core";

import {
  PREFERENCE_KEYS,
  type MessagePreferencesState,
  type PreferenceKey,
} from "../../lib/useMessagePreferences";

import { CollapsibleCard } from "./CollapsibleCard";
import * as styles from "./PostingPreferences.styles";

const COPY: Record<PreferenceKey, { label: string; description: string }> = {
  appendProfileLink: {
    label: "Auto-append inbox link",
    description: "Appends your link to every post. Reduces character budget.",
  },
  useGradients: {
    label: "Gradient backgrounds",
    description: "Pretty for screenshots. Turn off for higher contrast.",
  },
  includeQuestionAsImage: {
    label: "Question as image",
    description: "Generates a shareable image with auto alt text.",
  },
  confirmBeforeDelete: {
    label: "Confirm before deleting",
    description: "Leave off if you want to bulk-delete messages.",
  },
  autoScrollToMessages: {
    label: "Auto-scroll to messages",
    description: "Scrolls new messages into view when they load.",
  },
};

interface PostingPreferencesProps {
  state: MessagePreferencesState;
}

export function PostingPreferences({ state }: PostingPreferencesProps) {
  const { preferences, setPreference, enabledCount } = state;

  return (
    <CollapsibleCard
      title="Posting preferences"
      summary={`${enabledCount} of ${PREFERENCE_KEYS.length} on`}
    >
      {PREFERENCE_KEYS.map((key) => (
        <Box key={key} py="xs" style={styles.row}>
          <Switch
            checked={preferences[key]}
            onChange={(e) => setPreference(key, e.currentTarget.checked)}
            label={
              <Box>
                <Text fw={600} size="sm">
                  {COPY[key].label}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {COPY[key].description}
                </Text>
              </Box>
            }
          />
        </Box>
      ))}
    </CollapsibleCard>
  );
}
