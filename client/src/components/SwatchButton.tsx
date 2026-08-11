import { Text } from "@mantine/core";

import * as styles from "./SwatchButton.styles";

interface SwatchButtonProps {
  /** Visible caption, and the button's accessible name. */
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** The preview tile: a card mockup, a gradient fill, whatever the picker shows. */
  children: React.ReactNode;
}

/**
 * One option in a visual picker. Shared by the image-export theme picker and the
 * profile-card colour picker so the two agree on selection chrome, focus
 * behaviour and how they announce themselves.
 */
export function SwatchButton({ label, selected, disabled, onClick, children }: SwatchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      style={styles.button(selected, disabled)}
    >
      <div style={styles.preview}>{children}</div>
      <Text component="span" size="xs" fw={600} ta="center" style={styles.label}>
        {label}
      </Text>
    </button>
  );
}
