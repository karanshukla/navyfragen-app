import { Text } from "@mantine/core";

import { APP_NAME_WORDMARK } from "../lib/brand";
import { WinkMark } from "./WinkMark";

const [wordmarkFirst, wordmarkSecond] = APP_NAME_WORDMARK;

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
          fontFamily: "var(--ds-font-sans)",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        <span style={{ color: "var(--mantine-color-text)" }}>{wordmarkFirst}</span>
        <Text
          component="span"
          inherit
          variant="gradient"
          gradient={{ from: "royal", to: "purple", deg: 135 }}
          style={{ paddingBottom: "0.2em" }}
        >
          {wordmarkSecond}
        </Text>
      </span>
    </span>
  );
}
