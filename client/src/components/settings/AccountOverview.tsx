import { Paper, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";

import * as styles from "./AccountOverview.styles";

/** Deliberately unequal, to create visual hierarchy. */
const SIZE = { large: 32, medium: 22, small: 13 } as const;

export interface Stat {
  value: string | number;
  label: string;
  size: keyof typeof SIZE;
  truncate?: boolean;
}

interface AccountOverviewProps {
  loading: boolean;
  stats: Stat[];
}

export function AccountOverview({ loading, stats }: AccountOverviewProps) {
  return (
    <Paper withBorder style={styles.panel}>
      <Text fw={700} fz={18} mb={18}>
        Account Overview
      </Text>
      {loading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
          {stats.map((stat) => (
            <Stack key={stat.label} gap={4}>
              <Skeleton height={28} width="60%" radius="sm" />
              <Skeleton height={12} width="80%" radius="sm" />
            </Stack>
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl" style={{ alignItems: "flex-end" }}>
          {stats.map((stat) => (
            <Stack key={stat.label} gap={2} style={stat.truncate ? { minWidth: 0 } : undefined}>
              <Text fw={800} truncate={stat.truncate} style={styles.value(SIZE[stat.size])}>
                {stat.value}
              </Text>
              <Text size="xs" c="dimmed">
                {stat.label}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      )}
    </Paper>
  );
}
