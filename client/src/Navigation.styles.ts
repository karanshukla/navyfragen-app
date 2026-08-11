import type { CSSProperties } from "react";

import { border, radiusControl } from "./styles/tokens";

export const root: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

/** Nav items get a solid tint when active — deliberately never a gradient. */
export const navItem = (active: boolean) => ({
  root: {
    borderRadius: radiusControl,
    transition: "background var(--nf-dur-fast) var(--nf-ease)",
    ...(active
      ? {
          background: "var(--nf-nav-active-bg)",
          color: "var(--nf-nav-active-color)",
        }
      : {}),
  },
  label: {
    fontFamily: "var(--nf-font-sans)",
    fontSize: 16,
    fontWeight: active ? 600 : 500,
  },
});

export const friendsScroller: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0,
};

export const viewingProfile: CSSProperties = {
  borderRadius: radiusControl,
  background: "var(--mantine-color-default)",
  border,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
