import { Text } from "@mantine/core";

import { WinkMark } from "./WinkMark";

interface WordmarkProps {
  size?: number;
  showMark?: boolean;
}

export function Wordmark({ size = 22, showMark = true }: WordmarkProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
      }}
    >
      {showMark && <WinkMark size={size + 10} sparkle={false} aria-hidden />}
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        <span style={{ color: "var(--mantine-color-text)" }}>navy</span>
        <Text
          component="span"
          inherit
          variant="gradient"
          gradient={{ from: "royal", to: "purple", deg: 135 }}
          style={{ paddingBottom: "0.2em" }}
        >
          fragen
        </Text>
      </span>
    </span>
  );
}
