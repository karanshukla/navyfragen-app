import { createTheme } from "@mantine/core";

const navyfragenTheme = createTheme({
  colors: {
    deepBlue: [
      "#e0e8f5",
      "#c2d1e8",
      "#a3badb",
      "#85a3ce",
      "#678cc0",
      "#4975b3",
      "#3a68a6",
      "#2b5b99",
      "#1c4e8c",
      "#0d417f",
    ],
    blue: [
      "#e2e9f7",
      "#c5d3ef",
      "#a8bde7",
      "#8ba7df",
      "#6e91d7",
      "#517bcf",
      "#416cb9",
      "#315da3",
      "#224e8d",
      "#123f77",
    ],
  },

  shadows: {
    md: "1px 1px 3px rgba(0, 0, 0, .25)",
    xl: "5px 5px 3px rgba(0, 0, 0, .25)",
  },

  primaryColor: "deepBlue",
  defaultRadius: "md",
  fontFamily: "Noto Sans, sans-serif",
  scale: 1.05,
  headings: { fontFamily: "Noto Sans, sans-serif" },
});

export default navyfragenTheme;
