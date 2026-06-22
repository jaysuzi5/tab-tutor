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
  const per = pattern.subdivision === "triplet" ? 3 : pattern.subdivision === "sixteenth" ? 4 : 2;
  const beatsPerBar = 4;
  const perBar = beatsPerBar * per;
  const slots = pattern.slots;
  // Beat numbers restart each bar; subdivisions label the off-beats.
  const SIX = ["", "e", "&", "a"];
  const label = (i: number) => {
    const beat = Math.floor(i / per);
    const pos = i % per;
    const n = String((beat % beatsPerBar) + 1);
    if (per === 2) return pos === 0 ? n : "&";
    if (per === 4) return pos === 0 ? n : SIX[pos];
    return pos === 0 ? n : ""; // triplet
  };
  const barGap = (i: number) => (i > 0 && i % perBar === 0 ? { marginLeft: 14 } : undefined);

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
            <div key={i} className="sn-cell sn-arrow" style={barGap(i)}>{ARROW(s)}</div>
          ))}
        </div>
        <div className="sn-row">
          {slots.map((_, i) => (
            <div key={i} className="sn-cell sn-label" style={barGap(i)}>{label(i)}</div>
          ))}
        </div>
        <div className="sn-row sn-beams">
          {groups.map((g) => {
            const n = Math.min(per, slots.length - g);
            return (
              <div
                key={g}
                className={`sn-beam ${pattern.subdivision}`}
                style={{ width: n * 28, ...barGap(g) }}
              >
                {pattern.subdivision === "triplet" && n === 3 && <span>3</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
