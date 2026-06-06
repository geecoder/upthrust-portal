// Upthrust brand logo — the U-with-upward-arrow mark + wordmark.
// Recreated as crisp inline SVG (scales to any size, transparent background).
// Amber mark (#C5743A), wordmark colour configurable for dark/light surfaces.

export function UpthrustMark({ size = 28 }: { size?: number }) {
  // The mark: a rounded "U" whose right stroke continues up into an arrow.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer U stroke rising into an arrow on the right */}
      <path
        d="M16 12 V36 a16 16 0 0 0 32 0 V12"
        stroke="#C5743A"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        transform="translate(0,4)"
      />
      {/* Inner shorter U stroke (the double-line detail) */}
      <path
        d="M25 18 V36 a7 7 0 0 0 14 0"
        stroke="#C5743A"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
        transform="translate(0,4)"
      />
      {/* Arrow head on the right upright */}
      <path
        d="M48 20 L48 6 M41 13 L48 5 L55 13"
        stroke="#C5743A"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function UpthrustLogo({
  size = 26,
  wordmarkColor = '#FAF7F1',
  showWordmark = true,
  gap = 10,
}: {
  size?: number;
  wordmarkColor?: string;
  showWordmark?: boolean;
  gap?: number;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <UpthrustMark size={size} />
      {showWordmark && (
        <span
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: size * 0.72,
            fontWeight: 500,
            color: wordmarkColor,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Upthrust
        </span>
      )}
    </span>
  );
}
