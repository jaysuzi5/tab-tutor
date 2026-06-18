// Guitar headstock (3+3) showing the six strings of standard tuning (EADGBE).
// Each peg lights green once that string has been confirmed in tune, orange
// while it's the string currently being played (and not yet in tune).

const NOTE = (label: string) => label.replace(/\d/, ""); // "E2" -> "E"

// Peg layout: bass side (low E, A, D) left, treble side (G, B, high E) right.
const PEGS: { label: string; side: "L" | "R"; row: number }[] = [
  { label: "E2", side: "L", row: 0 },
  { label: "A2", side: "L", row: 1 },
  { label: "D3", side: "L", row: 2 },
  { label: "G3", side: "R", row: 2 },
  { label: "B3", side: "R", row: 1 },
  { label: "E4", side: "R", row: 0 },
];

export function Headstock({
  active,
  confirmed,
}: {
  active: string | null;
  confirmed: Set<string>;
}) {
  const W = 240, H = 280;
  const pegY = [70, 140, 210];
  const lx = 64, rx = W - 64;

  return (
    <svg className="headstock" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      {/* headstock body */}
      <rect x={W / 2 - 46} y={18} width={92} height={H - 50} rx={26} fill="#2a2118" stroke="#4a3c2a" strokeWidth={2} />
      {/* nut */}
      <rect x={W / 2 - 50} y={H - 30} width={100} height={10} rx={3} fill="#cbb894" />
      {PEGS.map((p) => {
        const x = p.side === "L" ? lx : rx;
        const y = pegY[p.row];
        const nx = p.side === "L" ? W / 2 - 40 : W / 2 + 40; // string anchor at nut
        const state = confirmed.has(p.label)
          ? "ok"
          : active === p.label
            ? "active"
            : "idle";
        const fill = state === "ok" ? "#4ade80" : state === "active" ? "#f59e0b" : "#3a3a3a";
        return (
          <g key={p.label}>
            {/* string from nut to peg */}
            <line x1={nx} y1={H - 25} x2={x} y2={y} stroke="#7a7a7a" strokeWidth={1.5} />
            <circle cx={x} cy={y} r={16} fill={fill} stroke="#1a1a1a" strokeWidth={2} />
            <text x={x} y={y + 5} textAnchor="middle" className="peg-note">
              {NOTE(p.label)}
            </text>
            {state === "ok" && (
              <text x={x} y={y - 22} textAnchor="middle" className="peg-check">✓</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
