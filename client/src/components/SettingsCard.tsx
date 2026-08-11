import { Paper, Text } from "@mantine/core";

import * as styles from "./SettingsCard.styles";

interface SettingsCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/** Owns the card surface; pass the action (button/switch/select) as children. */
export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Paper withBorder style={styles.card}>
      <Text fw={700} fz={18} mb={10}>
        {title}
      </Text>
      <Text c="dimmed" fz={13} style={styles.description}>
        {description}
      </Text>
      {children}
    </Paper>
  );
}
