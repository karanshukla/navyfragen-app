import { Box, Paper, Stack } from "@mantine/core";

import * as styles from "./AuthPanel.styles";

/**
 * The bordered card with a brand halo behind it, shared by the login form and
 * the OAuth callback so the redirect round trip does not visibly change surface.
 */
export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <Paper radius="lg" p="xl" withBorder style={styles.panel}>
      <Box style={styles.glow} />
      <Stack gap="md" style={styles.content}>
        {children}
      </Stack>
    </Paper>
  );
}
