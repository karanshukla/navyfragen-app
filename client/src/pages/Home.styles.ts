import type { CSSProperties } from "react";

import { accentText, link, surface, textDimmed } from "../styles/tokens";

export const infoCard: CSSProperties = {
  background: surface,
};

export const infoHeading: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: textDimmed,
  marginBottom: "var(--mantine-spacing-sm)",
};

export const hero: CSSProperties = {
  padding: "40px 24px",
  textAlign: "center",
  background: surface,
};

export const heroAvatar: CSSProperties = {
  border: "3px solid var(--mantine-color-default-border)",
};

export const greeting: CSSProperties = {
  letterSpacing: "-0.025em",
};

export const greetingName: CSSProperties = {
  color: accentText,
};

export const contactLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 15,
  color: link,
  textDecoration: "none",
};
