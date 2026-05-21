import { Paper, Text } from "@mantine/core";

import { surfaceBg } from "../styles/tokens";

interface SettingsCardProps {
  title: string;
  description: string;
  isDark: boolean;
  children: React.ReactNode;
}

/**
 * Uniform card shell used throughout the Settings page.
 * Owns the surface background, border-radius, padding, title, and description.
 * Pass the action (button / switch / select / skeleton) as children.
 */
export function SettingsCard({ title, description, isDark, children }: SettingsCardProps) {
  return (
    <Paper
      withBorder
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        padding: 20,
        background: surfaceBg(isDark),
      }}
    >
      <Text fw={700} fz={18} mb={10}>
        {title}
      </Text>
      <Text c="dimmed" fz={13} style={{ lineHeight: 1.5, flexGrow: 1, marginBottom: 16 }}>
        {description}
      </Text>
      {children}
    </Paper>
  );
}
