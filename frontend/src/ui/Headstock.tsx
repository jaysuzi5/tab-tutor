// Guitar headstock (3+3). `strings` are the tuning note labels low->high (6).
// Bass side (low E, A, D) on the left with the LOW E nearest the nut (bottom);
// treble side (G, B, high E) on the right. A peg turns green once that string
// is confirmed in tune, orange while it's the string currently being played.

const NOTE = (label: string) => label.replace(/-?\d+/, ""); // "Eb2" -> "Eb"

// (string index, side, row) — row 0 = top, 2 = bottom (nearest nut).
const LAYOUT = [
  { idx: 2, side: "L", row: 0 }, // D (top-left)
  { idx: 1, side: "L", row: 1 }, // A
  { idx: 0, side: "L", row: 2 }, // low E (bottom-left, nearest nut)
  { idx: 5, side: "R", row: 0 }, // high e (top-right)
  { idx: 4, side: "R", row: 1 }, // B
  { idx: 3, side: "R", row: 2 }, // G (bottom-right)
] as const;

export function Headstock({
  strings,
  activeIndex,
  confirmed,
}: {
  strings: string[];
  activeIndex: number | null;
  confirmed: Set<number>;
}) {
  const W = 240, H = 280;
  const pegY = [70, 140, 210];
  const lx = 64, rx = W - 64;

  return (
    <svg className="headstock" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <rect x={W / 2 - 46} y={18} width={92} height={H - 50} rx={26} fill="#2a2118" stroke="#4a3c2a" strokeWidth={2} />
      <rect x={W / 2 - 50} y={H - 30} width={100} height={10} rx={3} fill="#cbb894" />
      {LAYOUT.map((p) => {
        const x = p.side === "L" ? lx : rx;
        const y = pegY[p.row];
        const nx = p.side === "L" ? W / 2 - 40 : W / 2 + 40;
        const state = confirmed.has(p.idx)
          ? "ok"
          : activeIndex === p.idx
            ? "active"
            : "idle";
        const fill = state === "ok" ? "#4ade80" : state === "active" ? "#f59e0b" : "#3a3a3a";
        return (
          <g key={p.idx}>
            <line x1={nx} y1={H - 25} x2={x} y2={y} stroke="#7a7a7a" strokeWidth={1.5} />
            <circle cx={x} cy={y} r={16} fill={fill} stroke="#1a1a1a" strokeWidth={2} />
            <text x={x} y={y + 5} textAnchor="middle" className="peg-note">{NOTE(strings[p.idx] ?? "")}</text>
            {state === "ok" && <text x={x} y={y - 22} textAnchor="middle" className="peg-check">✓</text>}
          </g>
        );
      })}
    </svg>
  );
}
