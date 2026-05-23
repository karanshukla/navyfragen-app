import { Alert, Notification, createTheme, MantineColorsTuple } from "@mantine/core";

const royal: MantineColorsTuple = [
  "#EEF2FF", "#D9E0FF", "#B0BEFF", "#849BFF", "#6178FF",
  "#4A65FF", "#3B5BFF", "#2A47E6", "#1F38C2", "#142899",
];

const purple: MantineColorsTuple = [
  "#F3EEFF", "#E2D5FF", "#C7B0FE", "#AC8AFD", "#9C72FA",
  "#9162F8", "#8B5CF6", "#7847E0", "#6638C4", "#522BA3",
];

const midnight: MantineColorsTuple = [
  "#EDEBF7", "#D5D1EA", "#A8A2D0", "#7D74B6", "#594F9A",
  "#3F367D", "#2E2A6B", "#1E1B4B", "#14123A", "#0B0A24",
];

const sunshine: MantineColorsTuple = [
  "#FFF9E0", "#FFF1B8", "#FFE57A", "#FCD848", "#FBD129",
  "#FACC15", "#E0B70F", "#B89409", "#8F7206", "#665104",
];

// Dark mode surface colors — body=#0B0A24 (void), Paper/card=#15192B
const dark: MantineColorsTuple = [
  "#C4C0DC",   // [0] light text
  "#A9A5C8",   // [1]
  "#8B87B5",   // [2] dimmed text
  "#6E6A9E",   // [3] placeholder
  "#3A3660",   // [4] subtle border
  "#252040",   // [5] hover
  "#15192B",   // [6] Paper / card bg
  "#0B0A24",   // [7] body bg (void)
  "#080718",   // [8]
  "#050412",   // [9]
];

const navyfragenTheme = createTheme({
  primaryColor: "royal",
  primaryShade: { light: 6, dark: 4 },
  colors: { royal, purple, midnight, sunshine, dark },
  white: "#FDF8FF",
  black: "#1E1B4B",

  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, ui-monospace, monospace",

  headings: {
    fontFamily: "Inter, system-ui, sans-serif",
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
    xs: "0 1px 2px rgba(20,18,58,.06)",
    sm: "0 1px 2px rgba(20,18,58,.06), 0 1px 3px rgba(20,18,58,.04)",
    md: "0 4px 12px -2px rgba(20,18,58,.08), 0 2px 4px rgba(20,18,58,.04)",
    lg: "0 12px 30px -8px rgba(20,18,58,.18), 0 4px 10px rgba(20,18,58,.06)",
    xl: "0 30px 60px -20px rgba(20,18,58,.35)",
  },

  components: {
    Alert: Alert.extend({
      styles: (_theme, props) => {
        // Map semantic colors to brand-consistent translucent backgrounds.
        // Keeps the semantic signal without clashing with the purple-dominant palette.
        const bg: Record<string, string> = {
          red:    "rgba(220,38,38,0.09)",
          green:  "rgba(34,197,94,0.09)",
          yellow: "rgba(250,204,21,0.09)",
          royal:  "rgba(59,91,255,0.09)",
          blue:   "rgba(59,91,255,0.09)",
          purple: "rgba(139,92,246,0.09)",
        };
        const bd: Record<string, string> = {
          red:    "1px solid rgba(220,38,38,0.22)",
          green:  "1px solid rgba(34,197,94,0.22)",
          yellow: "1px solid rgba(250,204,21,0.22)",
          royal:  "1px solid rgba(59,91,255,0.22)",
          blue:   "1px solid rgba(59,91,255,0.22)",
          purple: "1px solid rgba(139,92,246,0.22)",
        };
        const c = (props.color as string | undefined) ?? "royal";
        return {
          root: {
            borderRadius: 12,
            background: bg[c] ?? bg.royal,
            border: bd[c] ?? bd.royal,
          },
          title: {
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
          },
        };
      },
    }),

    Notification: Notification.extend({
      styles: {
        root: { borderRadius: 12 },
        title: { fontFamily: "Inter, sans-serif", fontWeight: 700 },
      },
    }),
  },

  other: {
    gradHero: "linear-gradient(135deg, #3B5BFF 0%, #8B5CF6 55%, #C4B5FD 100%)",
    gradMark: "linear-gradient(135deg, #3349E0 0%, #6B3FD4 55%, #4F1FA6 100%)",
    gradDark: "linear-gradient(135deg, #1E1B4B 0%, #3B2E78 50%, #6B3FD4 100%)",
    paper2: "#F2EBFF",
    lavender: "#C4B5FD",
    ease: "cubic-bezier(.2,.7,.2,1)",
    durFast: "120ms",
    durBase: "200ms",
    durSlow: "360ms",
  },
});

export default navyfragenTheme;
