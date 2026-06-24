interface UBSLogoInlineProps {
  className?: string;
  keysColor?: string;
}

// Accurate UBS three-key heraldic symbol.
// Each key has: ornate ring bow (annulus + center dot), long shaft, two teeth on the side.
// Three keys are rotated 0° / 120° / 240° and share a common center.
const BOW_CX = 0;
const BOW_CY = -22;
const BOW_OUTER = 12;
const BOW_INNER = 6;
const BOW_DOT = 2.5;
const SHAFT_W = 5;
const SHAFT_TOP = -10;
const SHAFT_BOT = 30;
const TOOTH1_Y = 4;
const TOOTH1_L = 13;
const TOOTH2_Y = 14;
const TOOTH2_L = 9;
const TOOTH_H = 4.5;

// SVG arc helper: full circle as path (clockwise)
const circle = (cx: number, cy: number, r: number) =>
  `M ${cx + r},${cy} A ${r},${r} 0 1,0 ${cx - r},${cy} A ${r},${r} 0 1,0 ${cx + r},${cy} Z`;

// Key path: ring bow + shaft + two teeth
const KEY_PATH = [
  circle(BOW_CX, BOW_CY, BOW_OUTER),         // outer bow ring
  circle(BOW_CX, BOW_CY, BOW_INNER),          // inner cutout (evenodd makes it transparent)
  circle(BOW_CX, BOW_CY, BOW_DOT),            // center knob (third region = filled again)
  `M ${-SHAFT_W / 2},${SHAFT_TOP} L ${SHAFT_W / 2},${SHAFT_TOP} L ${SHAFT_W / 2},${SHAFT_BOT} L ${-SHAFT_W / 2},${SHAFT_BOT} Z`,
  `M ${SHAFT_W / 2},${TOOTH1_Y} L ${SHAFT_W / 2 + TOOTH1_L},${TOOTH1_Y} L ${SHAFT_W / 2 + TOOTH1_L},${TOOTH1_Y + TOOTH_H} L ${SHAFT_W / 2},${TOOTH1_Y + TOOTH_H} Z`,
  `M ${SHAFT_W / 2},${TOOTH2_Y} L ${SHAFT_W / 2 + TOOTH2_L},${TOOTH2_Y} L ${SHAFT_W / 2 + TOOTH2_L},${TOOTH2_Y + TOOTH_H} L ${SHAFT_W / 2},${TOOTH2_Y + TOOTH_H} Z`,
].join(' ');

function Key({ color }: { color: string }) {
  return <path d={KEY_PATH} fill={color} fillRule="evenodd" />;
}

export default function UBSLogoInline({ className = '', keysColor = 'currentColor' }: UBSLogoInlineProps) {
  return (
    <svg
      viewBox="0 0 200 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="UBS"
      className={className}
    >
      {/* Three crossed keys: 0° / 120° / 240° */}
      <g transform="translate(30,32)">
        <Key color={keysColor} />
        <g transform="rotate(120)"><Key color={keysColor} /></g>
        <g transform="rotate(240)"><Key color={keysColor} /></g>
      </g>

      {/* UBS wordmark */}
      <text
        x="72"
        y="48"
        fontFamily="'Arial Black', 'Arial Bold', Arial, Helvetica, sans-serif"
        fontSize="42"
        fontWeight="900"
        fill="#E30613"
        letterSpacing="-1"
      >
        UBS
      </text>
    </svg>
  );
}
