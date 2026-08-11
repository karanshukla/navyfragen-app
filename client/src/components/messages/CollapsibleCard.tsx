import { Box, Collapse, Paper, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import { useHaptic } from "use-haptic";

import * as styles from "./CollapsibleCard.styles";

interface CollapsibleCardProps {
  title: string;
  /** Right-aligned status shown in the header, e.g. "3 of 5 on". */
  summary: React.ReactNode;
  children: React.ReactNode;
}

/** Panel with a click-to-toggle header, open by default. */
export function CollapsibleCard({ title, summary, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(true);
  const { triggerHaptic } = useHaptic(1);

  return (
    <Paper withBorder p={0} style={styles.card}>
      <UnstyledButton
        aria-expanded={open}
        style={styles.header}
        onClick={() => {
          triggerHaptic();
          setOpen((o) => !o);
        }}
      >
        <Text component="span" fw={700} fz={15}>
          {title}
        </Text>
        <span style={styles.summary}>
          <Text component="span" size="xs" c="dimmed">
            {summary}
          </Text>
          <IconChevronDown size={16} style={styles.chevron(open)} />
        </span>
      </UnstyledButton>
      <Collapse expanded={open}>
        <Box px="md" pb="sm" style={styles.body}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
}
