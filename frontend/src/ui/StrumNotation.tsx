// Visual strumming notation: ▶ name + bpm, a row of down/up arrows, beat
// numbers (1 & 2 & … or 1 2 3 4 for triplets), and beams / triplet brackets.

import type { StrumPattern } from "../api";

const ARROW = (s: string) => (s === "D" ? "↓" : s === "U" ? "↑" : "");

export function StrumNotation({
  pattern,
  songBpm = 80,
  onPlay,
}: {
  pattern: StrumPattern;
  songBpm?: number;
  onPlay?: () => void;
}) {
  const per = pattern.subdivision === "triplet" ? 3 : 2;
  const slots = pattern.slots;
  const label = (i: number) =>
    per === 2 ? (i % 2 === 0 ? String(i / 2 + 1) : "&") : i % 3 === 0 ? String(i / 3 + 1) : "";

  const groups: number[] = [];
  for (let i = 0; i < slots.length; i += per) groups.push(i);

  return (
    <div className="strum-notation">
      <div className="sn-head">
        <button className="sn-play" onClick={onPlay} title="Play pattern">▶</button>
        <strong>{pattern.label || "Pattern"}</strong>
        <span className="muted"> {pattern.bpm || songBpm} bpm</span>
      </div>
      <div className="sn-rows">
        <div className="sn-row">
          {slots.map((s, i) => (
            <div key={i} className="sn-cell sn-arrow">{ARROW(s)}</div>
          ))}
        </div>
        <div className="sn-row">
          {slots.map((_, i) => (
            <div key={i} className="sn-cell sn-label">{label(i)}</div>
          ))}
        </div>
        <div className="sn-row sn-beams">
          {groups.map((g) => (
            <div
              key={g}
              className={`sn-beam ${pattern.subdivision}`}
              style={{ width: per * 28 }}
            >
              {pattern.subdivision === "triplet" && <span>3</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
