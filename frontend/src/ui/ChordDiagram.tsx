// SVG chord diagram: 6 strings (low-E left), first 4 frets, dots with finger
// numbers, o/x markers above the nut. Beginner finger-placement aid.

import { CHORD_SHAPES } from "../engine/chordShapes";

const FRETS = 4;
const W = 132;
const H = 168;
const L = 16; // left/right padding
const TOP = 26; // room for o/x markers above nut
const BOT = 14;

export function ChordDiagram({ chord, size = 1 }: { chord: string; size?: number }) {
  const shape = CHORD_SHAPES[chord];
  if (!shape) return null;

  const base = shape.baseFret ?? 1; // first fret shown (up-neck shapes)
  const innerW = W - L * 2;
  const innerH = H - TOP - BOT;
  const sGap = innerW / 5; // 6 strings -> 5 gaps
  const fGap = innerH / FRETS;
  const sx = (i: number) => L + i * sGap;
  const fy = (f: number) => TOP + f * fGap;

  return (
    <svg
      className="chord-diagram"
      viewBox={`0 0 ${W} ${H}`}
      width={W * size}
      height={H * size}
      role="img"
      aria-label={`${chord} chord diagram`}
    >
      {/* nut (thick) + frets */}
      {Array.from({ length: FRETS + 1 }, (_, f) => (
        <line
          key={`f${f}`}
          x1={L}
          y1={fy(f)}
          x2={L + innerW}
          y2={fy(f)}
          stroke="#cbd2da"
          strokeWidth={f === 0 && base === 1 ? 3.5 : 1}
        />
      ))}
      {/* base-fret label for up-neck shapes (no thick nut) */}
      {base > 1 && (
        <text x={L - 6} y={TOP + fGap * 0.7} className="cd-fret" textAnchor="end">
          {base}fr
        </text>
      )}
      {/* strings */}
      {shape.frets.map((_, i) => (
        <line
          key={`s${i}`}
          x1={sx(i)}
          y1={TOP}
          x2={sx(i)}
          y2={TOP + innerH}
          stroke="#cbd2da"
          strokeWidth={1}
        />
      ))}
      {/* markers + finger dots */}
      {shape.frets.map((fret, i) => {
        if (fret === -1)
          return (
            <text key={`m${i}`} x={sx(i)} y={TOP - 10} className="cd-x" textAnchor="middle">
              ×
            </text>
          );
        if (fret === 0)
          return (
            <circle key={`m${i}`} cx={sx(i)} cy={TOP - 13} r={4} className="cd-open" />
          );
        const cy = TOP + (fret - base + 0.5) * fGap; // position relative to base fret
        const finger = shape.fingers[i];
        return (
          <g key={`d${i}`}>
            <circle cx={sx(i)} cy={cy} r={8} className="cd-dot" />
            {finger > 0 && (
              <text x={sx(i)} y={cy + 4} className="cd-finger" textAnchor="middle">
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
