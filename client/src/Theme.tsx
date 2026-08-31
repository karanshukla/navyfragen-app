import { Alert, Notification, createTheme, MantineColorsTuple } from "@mantine/core";

const royal: MantineColorsTuple = [
  "#EEF2FF",
  "#D9E0FF",
  "#B0BEFF",
  "#849BFF",
  "#6178FF",
  "#4A65FF",
  "#3B5BFF",
  "#2A47E6",
  "#1F38C2",
  "#142899",
];

const purple: MantineColorsTuple = [
  "#F3EEFF",
  "#E2D5FF",
  "#C7B0FE",
  "#AC8AFD",
  "#9C72FA",
  "#9162F8",
  "#8B5CF6",
  "#7847E0",
  "#6638C4",
  "#522BA3",
];

const midnight: MantineColorsTuple = [
  "#EDEBF7",
  "#D5D1EA",
  "#A8A2D0",
  "#7D74B6",
  "#594F9A",
  "#3F367D",
  "#2E2A6B",
  "#1E1B4B",
  "#14123A",
  "#0B0A24",
];

const sunshine: MantineColorsTuple = [
  "#FFF9E0",
  "#FFF1B8",
  "#FFE57A",
  "#FCD848",
  "#FBD129",
  "#FACC15",
  "#E0B70F",
  "#B89409",
  "#8F7206",
  "#665104",
];

/**
 * Destructive actions. Previously spelled `color="crimson"`, which is not a
 * Mantine palette entry — it fell through to the CSS named colour and so had no
 * hover, light or outline variants.
 */
const crimson: MantineColorsTuple = [
  "#FFF0F0",
  "#FFD8D8",
  "#F5A9A9",
  "#E97C7C",
  "#DC5A5A",
  "#D13F3F",
  "#C92A2A",
  "#A82121",
  "#8A1B1B",
  "#6B1414",
];

// Dark mode surface colors — body=#0B0A24 (void), Paper/card=#15192B
const dark: MantineColorsTuple = [
  "#C4C0DC", // [0] light text
  "#A9A5C8", // [1]
  "#8B87B5", // [2] dimmed text
  "#6E6A9E", // [3] placeholder
  "#3A3660", // [4] subtle border
  "#252040", // [5] hover
  "#15192B", // [6] Paper / card bg
  "#0B0A24", // [7] body bg (void)
  "#080718", // [8]
  "#050412", // [9]
];

/**
 * Semantic tones for `Alert`. One row per colour instead of three parallel
 * lookup tables, so a tone cannot be half-defined. The tints are alpha over
 * whatever the page background is, which reads correctly in both schemes; the
 * title colour cannot be, so it comes from a scheme-aware token.
 *
 * @see [contrast.test.ts](./tests/theme/contrast.test.ts): pins every title
 * colour against its own tint at WCAG AA.
 */
export const ALERT_TONES = {
  red: { rgb: "220,38,38", title: "var(--ds-tone-red)" },
  crimson: { rgb: "201,42,42", title: "var(--ds-tone-red)" },
  green: { rgb: "34,197,94", title: "var(--ds-tone-green)" },
  yellow: { rgb: "250,204,21", title: "var(--ds-tone-yellow)" },
  royal: { rgb: "59,91,255", title: "var(--ds-tone-royal)" },
  blue: { rgb: "59,91,255", title: "var(--ds-tone-royal)" },
  purple: { rgb: "139,92,246", title: "var(--ds-tone-purple)" },
} as const;

const DEFAULT_ALERT_TONE = ALERT_TONES.royal;

const navyfragenTheme = createTheme({
  primaryColor: "royal",
  // Flat rather than {light: 6, dark: 4}: shade 4 as a filled background puts
  // white button labels at 3.6:1. Text keeps its own per-scheme token below.
  primaryShade: 6,
  colors: { royal, purple, midnight, sunshine, crimson, dark },
  white: "#FDF8FF",
  black: "#1E1B4B",

  fontFamily: "var(--ds-font-sans)",

  headings: {
    fontFamily: "var(--ds-font-sans)",
    fontWeight: "800",
    sizes: {
      h1: { fontSize: "42px", lineHeight: "1.1", fontWeight: "800" },
      h2: { fontSize: "28px", lineHeight: "1.15", fontWeight: "700" },
      h3: { fontSize: "22px", lineHeight: "1.2", fontWeight: "700" },
      h4: { fontSize: "17px", lineHeight: "1.3", fontWeight: "600" },
    },
  },

  defaultRadius: "md",
  radius: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "22px" },
  spacing: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },

  shadows: {
    xs: "0 1px 2px rgba(20,18,58,.06)" /* i18n-allow */,
    sm: "0 1px 2px rgba(20,18,58,.06), 0 1px 3px rgba(20,18,58,.04)" /* i18n-allow */,
    md: "0 4px 12px -2px rgba(20,18,58,.08), 0 2px 4px rgba(20,18,58,.04)" /* i18n-allow */,
    lg: "0 12px 30px -8px rgba(20,18,58,.18), 0 4px 10px rgba(20,18,58,.06)" /* i18n-allow */,
    xl: "0 30px 60px -20px rgba(20,18,58,.35)" /* i18n-allow */,
  },

  components: {
    Alert: Alert.extend({
      styles: (_theme, props) => {
        const tone = ALERT_TONES[props.color as keyof typeof ALERT_TONES] ?? DEFAULT_ALERT_TONE;
        return {
          root: {
            borderRadius: "var(--ds-radius-control)",
            background: `rgba(${tone.rgb},0.09)`,
            border: `1px solid rgba(${tone.rgb},0.22)`,
          },
          title: {
            fontFamily: "var(--ds-font-sans)",
            fontWeight: 700,
            color: tone.title,
          },
        };
      },
    }),

    Notification: Notification.extend({
      styles: {
        root: { borderRadius: "var(--ds-radius-control)" },
        title: { fontFamily: "var(--ds-font-sans)", fontWeight: 700 },
      },
    }),
  },
});

export default navyfragenTheme;
