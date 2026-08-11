import type { CSSProperties } from "react";

/** Sticky so the group label stays put while its list scrolls under it. */
export const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  width: "100%",
  cursor: "pointer",
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "var(--mantine-color-body)",
  paddingTop: "var(--mantine-spacing-lg)",
};

export const chevron = (open: boolean): CSSProperties => ({
  color: "var(--mantine-color-dimmed)",
  transition: "transform var(--nf-dur-fast) var(--nf-ease)",
  transform: open ? "rotate(0deg)" : "rotate(-90deg)",
  flexShrink: 0,
});

export const friendLink = {
  root: {
    borderRadius: 10,
    transition: "background var(--nf-dur-fast) var(--nf-ease)",
  },
} as const;
