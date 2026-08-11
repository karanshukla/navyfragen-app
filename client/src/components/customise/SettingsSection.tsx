import { Grid, Text } from "@mantine/core";

import * as styles from "./SettingsSection.styles";

interface SettingsSectionProps {
  eyebrow: string;
  help: string;
  last?: boolean;
  children: React.ReactNode;
}

/** A titled band of setting cards. */
export function SettingsSection({ eyebrow, help, last, children }: SettingsSectionProps) {
  return (
    <div style={styles.section(last)}>
      <Text tt="uppercase" fw={700} fz={12} c="dimmed" style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <Text c="dimmed" fz={13} mb="md">
        {help}
      </Text>
      <Grid style={{ gap: "var(--mantine-spacing-md)" }}>{children}</Grid>
    </div>
  );
}
