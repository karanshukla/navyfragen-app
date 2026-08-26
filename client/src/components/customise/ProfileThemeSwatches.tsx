import { useTranslations } from "../../lib/i18n";
import { profileCardThemes } from "../../lib/themes";
import { SwatchButton } from "../SwatchButton";

import * as styles from "./ProfileThemeSwatches.styles";

const DEFAULT_THEME = "royal";
const COLOUR_BAND_ASPECT = "16/9";

interface ProfileThemeSwatchesProps {
  value: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}

/**
 * Ask-card colour picker. Same swatch chrome as the image-theme picker; the
 * preview is a gradient band rather than a card mockup, because the choice only
 * affects the card's background.
 *
 * @see [ProfileThemeSwatches.test.tsx](../../tests/components/ProfileThemeSwatches.test.tsx)
 * — pins the band.
 */
export function ProfileThemeSwatches({ value, disabled, onPick }: ProfileThemeSwatchesProps) {
  const messages = useTranslations();
  return (
    <div style={styles.grid}>
      {Object.entries(profileCardThemes(messages)).map(([themeValue, theme]) => (
        <SwatchButton
          key={themeValue}
          label={theme.label}
          selected={(value ?? DEFAULT_THEME) === themeValue}
          disabled={disabled}
          onClick={() => onPick(themeValue)}
          previewAspect={COLOUR_BAND_ASPECT}
        >
          <div style={styles.fill(theme.gradient)} />
        </SwatchButton>
      ))}
    </div>
  );
}
