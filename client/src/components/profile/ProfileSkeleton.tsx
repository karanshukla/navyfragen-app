import { Box, Container, Group, Paper, Skeleton } from "@mantine/core";

import * as cardStyles from "./ProfileCard.styles";
import * as styles from "./ProfileSkeleton.styles";

/** Placeholder matching the loaded profile's geometry, so nothing jumps. */
export function ProfileSkeleton() {
  return (
    <Container>
      <Skeleton height={28} width={180} radius={999} mb="sm" />

      <Paper mb="lg" withBorder style={cardStyles.card}>
        <Skeleton height={160} radius={0} />
        <Box style={styles.body}>
          <Skeleton circle height={84} width={84} style={cardStyles.avatar} />
          <Group justify="space-between" align="flex-start" pt={52}>
            <Box>
              <Skeleton height={28} width={180} mb={6} />
              <Skeleton height={14} width={120} />
            </Box>
            <Skeleton height={28} width={130} radius={999} />
          </Group>
          <Skeleton height={14} mt="sm" />
          <Skeleton height={14} mt={6} width="75%" />
        </Box>
      </Paper>

      <Paper style={styles.askCard}>
        <Skeleton height={26} width="70%" mx="auto" mb="lg" />
        <Skeleton height={80} radius="md" mb="xs" />
        <Group justify="flex-end" gap="xs">
          <Skeleton height={36} width={36} radius="md" />
          <Skeleton height={36} width={90} radius={999} />
        </Group>
      </Paper>
    </Container>
  );
}
