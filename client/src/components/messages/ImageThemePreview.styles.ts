import type { CSSProperties } from "react";

import { gradDark } from "../../styles/tokens";

/**
 * Miniature mockups of the three image-export themes.
 *
 * These deliberately do NOT use app tokens beyond the gradient: they depict what
 * the rendered PNG looks like, which is a fixed artefact that does not follow the
 * viewer's colour scheme. Treating them as themeable UI would make the preview
 * lie about the output.
 */

const bar = (height: number, background: string, extra?: CSSProperties): CSSProperties => ({
  height,
  background,
  borderRadius: 2,
  ...extra,
});

/* ── default: white quote card on the brand dark gradient ── */

export const defaultRoot: CSSProperties = {
  background: gradDark,
  height: "100%",
  borderRadius: 5,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "8px 10px",
  gap: 6,
};

export const centered: CSSProperties = { display: "flex", justifyContent: "center" };
export const defaultHeading = bar(2.5, "rgba(255,255,255,0.7)", { width: "55%" });
export const defaultQuote: CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: "6px 10px",
  boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
};
export const defaultQuoteLine = bar(3.5, "#ccc", { marginBottom: 4 });
export const defaultQuoteLineShort = bar(3.5, "#ccc", { width: "65%" });
export const defaultFooter = bar(2, "rgba(255,255,255,0.4)", { width: "40%" });

/* ── compressed: accent-ruled block on a near-black field ── */

export const compressedRoot: CSSProperties = {
  background: "#1a1a2a",
  height: "100%",
  borderRadius: 5,
  display: "flex",
  alignItems: "center",
  padding: 8,
};
export const compressedBlock: CSSProperties = {
  background: "#22223a",
  borderLeft: "3px solid #7c3aed",
  borderRadius: 6,
  padding: "7px 9px",
  width: "100%",
};
export const compressedTitle = bar(3, "#a78bfa", {
  borderRadius: 3,
  marginBottom: 5,
  width: "45%",
});
export const compressedLine = bar(3, "#4a4a6a", { borderRadius: 3, marginBottom: 3 });
export const compressedLineShort = bar(3, "#4a4a6a", {
  borderRadius: 3,
  width: "70%",
  marginBottom: 5,
});
export const compressedMeta = bar(2.5, "#3a3a5a", { width: "45%" });

/* ── twitter: light post card ── */

export const twitterRoot: CSSProperties = {
  background: "#ffffff",
  height: "100%",
  borderRadius: 5,
  display: "flex",
  alignItems: "center",
};
export const twitterCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #cfd9de",
  borderRadius: 8,
  padding: "7px 9px",
  width: "100%",
};
export const twitterHeader: CSSProperties = {
  display: "flex",
  gap: 5,
  marginBottom: 5,
  alignItems: "center",
};
export const twitterAvatar: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#1d9bf0",
  flexShrink: 0,
};
export const twitterName = bar(2.5, "#333", { marginBottom: 2 });
export const twitterHandle = bar(2.5, "#aaa", { width: "55%" });
export const twitterLine = bar(2.5, "#ccc", { marginBottom: 3 });
export const twitterLineShort = bar(2.5, "#ccc", { width: "75%", marginBottom: 4 });
export const twitterRule: CSSProperties = { height: 1, background: "#eff3f4", marginBottom: 3 };
export const twitterAction = bar(2.5, "#1d9bf0", { width: "40%" });
