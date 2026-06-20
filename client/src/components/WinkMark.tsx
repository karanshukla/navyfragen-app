interface WinkMarkProps {
  size?: number;
  sparkle?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}

export function WinkMark({
  size = 40,
  sparkle = true,
  className,
  style,
  "aria-hidden": ariaHidden,
}: WinkMarkProps) {
  const gradId = `nf-mark-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "Navyfragen"}
      aria-hidden={ariaHidden}
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3349E0" />
          <stop offset="55%" stopColor="#6B3FD4" />
          <stop offset="100%" stopColor="#4F1FA6" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="36" fill={`url(#${gradId})`} />
      <ellipse cx="40" cy="100" rx="11" ry="6" fill="#FDF8FF" opacity="0.18" />
      <ellipse cx="120" cy="100" rx="11" ry="6" fill="#FDF8FF" opacity="0.18" />
      <circle cx="60" cy="66" r="10" fill="#FDF8FF" />
      <path
        d="M88 70 Q100 56 112 70"
        stroke="#FDF8FF"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 96 Q80 124 110 96"
        stroke="#FDF8FF"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      {sparkle && (
        <path
          d="M130 32 L133 42 L143 45 L133 48 L130 58 L127 48 L117 45 L127 42 Z"
          fill="#FACC15"
        />
      )}
    </svg>
  );
}
