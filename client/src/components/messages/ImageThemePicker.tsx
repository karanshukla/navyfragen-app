import { Box, Group } from "@mantine/core";

import { useTranslations } from "../../lib/i18n";
import { imageThemeLabels } from "../../lib/themes";
import { ShortcutList } from "../ShortcutList";
import { SwatchButton } from "../SwatchButton";

import { CollapsibleCard } from "./CollapsibleCard";
import { ImageThemePreview } from "./ImageThemePreview";

const DEFAULT_THEME = "default";

interface ImageThemePickerProps {
  /** Null until settings load, so the default is shown rather than nothing. */
  selected: string | null;
  disabled: boolean;
  onSelect: (theme: string) => void;
}

export function ImageThemePicker({ selected, disabled, onSelect }: ImageThemePickerProps) {
  const active = selected ?? DEFAULT_THEME;
  const messages = useTranslations();
  const themes = imageThemeLabels(messages);
  const shortcuts = [
    { label: messages.common.shortcuts.focusCycleCards, hint: "Alt+R" /* i18n-allow */ },
    { label: messages.common.shortcuts.navigateCards, hint: "↑ / ↓" /* i18n-allow */ },
    { label: messages.common.shortcuts.closeExpandedCard, hint: "Esc" /* i18n-allow */ },
  ];

  return (
    <CollapsibleCard
      title={messages.imageThemePicker.title}
      summary={themes[active as keyof typeof themes]}
    >
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
        <ShortcutList title={messages.common.shortcuts.title} shortcuts={shortcuts} />
      </Box>
    </CollapsibleCard>
  );
}
