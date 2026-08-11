import type { CSSProperties } from "react";

import {
  borderColor,
  gradMark,
  onGrad,
  onGradAccent,
  onGradFaint,
  onGradMuted,
  radiusCard,
  surface,
  textDefault,
  textDimmed,
} from "../../styles/tokens";

export interface CardState {
  gradient: boolean;
  pinned: boolean;
  focused: boolean;
}

/**
 * A question card is painted either with the brand gradient or with the ordinary
 * card surface, and everything inside it has to follow. Rather than each Text
 * repeating the choice — which is how the message body ended up hard-coded to
 * white and therefore invisible on the light surface — the card publishes four
 * `--nf-card-*` custom properties and its children read those.
 */
function foreground(gradient: boolean): CSSProperties {
  return {
    "--nf-card-fg": gradient ? onGrad : textDefault,
    "--nf-card-fg-muted": gradient ? onGradMuted : textDimmed,
    "--nf-card-fg-faint": gradient ? onGradFaint : textDimmed,
    "--nf-card-accent": gradient ? onGradAccent : "var(--nf-link)",
    "--nf-card-edge": gradient ? "rgba(255,255,255,0.10)" : borderColor,
  } as CSSProperties;
}

function borderFor({ pinned, focused }: CardState): string {
  if (pinned) return "2px solid var(--nf-royal)";
  if (focused) return "2px solid var(--nf-purple)";
  return "2px solid var(--nf-card-edge)";
}

export const card = (state: CardState): CSSProperties => ({
  ...foreground(state.gradient),
  borderRadius: radiusCard,
  background: state.gradient ? gradMark : surface,
  border: borderFor(state),
  boxShadow: state.pinned
    ? "0 4px 22px -4px rgba(59,91,255,0.38)"
    : "0 4px 16px -8px rgba(0,0,0,0.3)",
  padding: "8px 20px 20px",
  transition:
    "border-color var(--nf-dur-fast) var(--nf-ease), box-shadow var(--nf-dur-fast) var(--nf-ease)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
});

export const timestamp: CSSProperties = {
  color: "var(--nf-card-fg-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const iconButton = (active: boolean): CSSProperties => ({
  color: active ? "var(--nf-royal)" : "var(--nf-card-fg-muted)",
  transition:
    "color var(--nf-dur-fast) var(--nf-ease), background var(--nf-dur-fast) var(--nf-ease)",
});

export const disabledIconButton: CSSProperties = {
  color: "var(--nf-card-fg-faint)",
  cursor: "not-allowed",
};

export const bodyWrap: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const body: CSSProperties = {
  color: "var(--nf-card-fg)",
  fontSize: 20,
  lineHeight: 1.35,
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
  textAlign: "center",
  textWrap: "balance",
  width: "100%",
};

export const threadLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: "var(--nf-card-accent)",
  textDecoration: "none",
  fontSize: 11,
};

export const threadLinkText: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const replyButton = (blocked: boolean): CSSProperties => ({
  color: "var(--nf-midnight)",
  opacity: blocked ? 0.45 : 1,
  cursor: blocked ? "not-allowed" : undefined,
});
