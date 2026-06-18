// Editable list of strumming patterns: each has a name, bpm, subdivision
// (eighths or triplets), and a clickable arrow grid (cycle down/up/rest). Plus
// a play button to hear it.

import type { StrumPattern } from "../api";
import { playStrum } from "../engine/strumAudio";

const ARROW = (s: string) => (s === "D" ? "↓" : s === "U" ? "↑" : "·");
const perOf = (sub: string) => (sub === "triplet" ? 3 : 2);
const perBar = (sub: string) => 4 * perOf(sub); // 4 beats/bar
const newSlots = (sub: string, bars = 1) => Array(perBar(sub) * bars).fill("D");

export function StrumEditor({
  value,
  onChange,
  defaultBpm,
}: {
  value: StrumPattern[];
  onChange: (v: StrumPattern[]) => void;
  defaultBpm: number;
}) {
  const setRow = (i: number, patch: Partial<StrumPattern>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const cycle = (i: number, slot: number) =>
    setRow(i, {
      slots: value[i].slots.map((s, idx) =>
        idx === slot ? (s === "D" ? "U" : s === "U" ? "" : "D") : s,
      ),
    });

  return (
    <div className="strum-editor">
      <h4>Strumming patterns</h4>
      {value.map((p, i) => (
        <div key={i} className="se-pattern">
          <div className="se-head">
            <input
              placeholder="Note (e.g. Verse)"
              value={p.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
            />
            <input
              type="number"
              className="se-bpm"
              placeholder="bpm"
              value={p.bpm || ""}
              onChange={(e) => setRow(i, { bpm: Number(e.target.value) })}
            />
            <select
              value={p.subdivision}
              onChange={(e) => {
                const bars = Math.max(1, Math.round(p.slots.length / perBar(p.subdivision)));
                setRow(i, {
                  subdivision: e.target.value as StrumPattern["subdivision"],
                  slots: newSlots(e.target.value, bars),
                });
              }}
            >
              <option value="eighth">8ths</option>
              <option value="triplet">Triplets</option>
            </select>
            <span className="se-bars">
              <button
                className="ghost"
                title="remove a bar"
                disabled={p.slots.length <= perBar(p.subdivision)}
                onClick={() => setRow(i, { slots: p.slots.slice(0, -perBar(p.subdivision)) })}
              >−bar</button>
              <button
                className="ghost"
                title="add a bar"
                onClick={() => setRow(i, { slots: [...p.slots, ...Array(perBar(p.subdivision)).fill("")] })}
              >+bar</button>
            </span>
            <button className="ghost" onClick={() => playStrum(p, defaultBpm)}>▶</button>
            <button className="ghost" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</button>
          </div>
          <div className="se-grid">
            {p.slots.map((s, slot) => (
              <button
                key={slot}
                className={`se-slot ${s === "" ? "rest" : ""}`}
                style={slot > 0 && slot % perBar(p.subdivision) === 0 ? { marginLeft: 14 } : undefined}
                onClick={() => cycle(i, slot)}
              >
                {ARROW(s)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="ghost"
        onClick={() =>
          onChange([...value, { label: "", bpm: defaultBpm, subdivision: "eighth", slots: newSlots("eighth") }])
        }
      >
        + Add pattern
      </button>
    </div>
  );
}
