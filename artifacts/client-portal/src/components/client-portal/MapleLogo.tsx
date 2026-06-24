interface MapleLogoProps {
  className?: string;
  color?: string;
}

// Maple Finance-inspired logo:
// Abstract swoosh mark (like maple samara keys / wings) + "Maple" wordmark
export default function MapleLogo({ className = '', color = '#0D0D0D' }: MapleLogoProps) {
  return (
    <svg
      viewBox="0 0 210 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Maple"
      className={className}
    >
      {/* Mark: 3 curved bands — maple key / samara wing motif */}
      {/* Top band — narrow */}
      <path
        d="M2,9 C10,5 22,4 36,9 L36,16 C22,11 10,12 2,16 Z"
        fill={color}
      />
      {/* Middle band — medium */}
      <path
        d="M2,20 C12,15 26,14 42,20 L42,27 C26,21 12,22 2,27 Z"
        fill={color}
        fillOpacity="0.70"
      />
      {/* Bottom band — widest */}
      <path
        d="M2,31 C14,25 30,24 48,31 L48,38 C30,31 14,32 2,38 Z"
        fill={color}
        fillOpacity="0.40"
      />

      {/* Wordmark */}
      <text
        x="58"
        y="40"
        fontFamily="'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="28"
        fontWeight="700"
        fill={color}
        letterSpacing="-0.3"
      >
        Maple
      </text>
    </svg>
  );
}
