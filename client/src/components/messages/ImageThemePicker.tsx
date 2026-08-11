import { Box, Group } from "@mantine/core";

import { themes } from "../../lib/themes";
import { ShortcutList } from "../ShortcutList";
import { SwatchButton } from "../SwatchButton";

import { CollapsibleCard } from "./CollapsibleCard";
import { ImageThemePreview } from "./ImageThemePreview";

const DEFAULT_THEME = "default";

const SHORTCUTS = [
  { label: "Focus / cycle cards", hint: "Alt+R" },
  { label: "Navigate cards", hint: "↑ / ↓" },
  { label: "Close expanded card", hint: "Esc" },
];

interface ImageThemePickerProps {
  /** Null until settings load, so the default is shown rather than nothing. */
  selected: string | null;
  disabled: boolean;
  onSelect: (theme: string) => void;
}

export function ImageThemePicker({ selected, disabled, onSelect }: ImageThemePickerProps) {
  const active = selected ?? DEFAULT_THEME;

  return (
    <CollapsibleCard title="Image theme" summary={themes[active as keyof typeof themes]}>
      <Group grow gap="sm" mt="sm">
        {Object.entries(themes).map(([value, label]) => (
          <SwatchButton
            key={value}
            label={label}
            selected={active === value}
            onClick={() => {
              if (disabled) return;
              onSelect(value);
            }}
          >
            <ImageThemePreview theme={value} />
          </SwatchButton>
        ))}
      </Group>

      <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        <ShortcutList title="Keyboard Shortcuts" shortcuts={SHORTCUTS} />
      </Box>
    </CollapsibleCard>
  );
}
