const RADIUS = 9;
const SIZE = 22;
const CENTRE = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Fraction of the budget at which the ring switches to the warning colour. */
const DANGER_AT = 0.9;

/**
 * Circular character-budget meter for the reply composer.
 *
 * Both stroke colours are the composer's own, not the brand ones: the ring is
 * drawn on the composer's paper surface, where `--ds-highlight` sits at 1.7:1 and
 * the track was invisible entirely.
 *
 * @see [Messages.test.tsx](../../tests/pages/Messages.test.tsx): pins the switch
 * to the warning colour past 90% of the limit.
 */
export function CharRing({ count, limit }: { count: number; limit: number }) {
  const filled = Math.min(count / limit, 1);
  const stroke = count > limit * DANGER_AT ? "var(--ds-compose-warn)" : "var(--ds-compose-accent)";

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={RADIUS}
        fill="none"
        stroke="var(--ds-compose-track)"
        strokeWidth={2.5}
      />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={RADIUS}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE - filled * CIRCUMFERENCE}
        transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
        strokeLinecap="round"
      />
    </svg>
  );
}
