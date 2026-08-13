import { Group, Paper, Text } from "@mantine/core";

import * as styles from "./SettingsCard.styles";

interface SettingsCardProps {
  title: string;
  description: string;
  /** This card's state, shown beside the title: a switch, or a status badge. */
  control?: React.ReactNode;
  /** Dimmed line closing the description — usually why the card is unavailable. */
  note?: string;
  /** The action — a button, an input, a picker. Anchored to the card's bottom. */
  children?: React.ReactNode;
}

/**
 * Owns the card surface and the one layout rule the settings pages follow:
 * state sits next to the title, the action sits at the bottom edge.
 */
export function SettingsCard({ title, description, control, note, children }: SettingsCardProps) {
  return (
    <Paper withBorder style={styles.card}>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm" style={styles.header}>
        <Text fw={700} fz={18}>
          {title}
        </Text>
        {control}
      </Group>
      <div style={styles.body}>
        <Text c="dimmed" fz={13} style={styles.description}>
          {description}
        </Text>
        {note && (
          <Text c="dimmed" fz={12} style={styles.note}>
            {note}
          </Text>
        )}
      </div>
      {children}
    </Paper>
  );
}
