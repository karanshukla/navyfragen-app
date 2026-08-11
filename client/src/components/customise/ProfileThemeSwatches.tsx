import { profileCardThemes } from "../../lib/themes";
import { SwatchButton } from "../SwatchButton";

import * as styles from "./ProfileThemeSwatches.styles";

const DEFAULT_THEME = "royal";

interface ProfileThemeSwatchesProps {
  value: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}

/**
 * Ask-card colour picker. Same swatch chrome as the image-theme picker; the
 * preview is a gradient fill rather than a card mockup, because the choice only
 * affects the card's background.
 */
export function ProfileThemeSwatches({ value, disabled, onPick }: ProfileThemeSwatchesProps) {
  return (
    <div style={styles.grid}>
      {Object.entries(profileCardThemes).map(([themeValue, theme]) => (
        <SwatchButton
          key={themeValue}
          label={theme.label}
          selected={(value ?? DEFAULT_THEME) === themeValue}
          disabled={disabled}
          onClick={() => onPick(themeValue)}
        >
          <div style={styles.fill(theme.gradient)} />
        </SwatchButton>
      ))}
    </div>
  );
}
