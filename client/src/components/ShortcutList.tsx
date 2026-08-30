import { Box, Stack, Text, Title } from "@mantine/core";

import * as styles from "./ShortcutList.styles";

export interface Shortcut {
  label: string;
  /** Written with the literal "Alt"; the ⌘ alternative is rendered in. */
  hint: string;
}

interface ShortcutListProps {
  title: string;
  shortcuts: Shortcut[];
}

/**
 * Keyboard-shortcut reference. Shared by the home page and the Messages image
 * theme panel, which previously kept two copies that disagreed on type sizes and
 * on whether the modifier read "Alt/Cmd" or "Alt/⌘".
 */
export function ShortcutList({ title, shortcuts }: ShortcutListProps) {
  return (
    <>
      <Title order={2} style={styles.heading}>
        {title}
      </Title>
      <Stack gap={6}>
        {shortcuts.map(({ label, hint }) => (
          <Box key={label} style={styles.row}>
            <Text fz={13}>{label}</Text>
            <Text fz={12} c="dimmed">
              {hint.replace("Alt", "Alt/⌘") /* i18n-allow */}
            </Text>
          </Box>
        ))}
      </Stack>
    </>
  );
}
