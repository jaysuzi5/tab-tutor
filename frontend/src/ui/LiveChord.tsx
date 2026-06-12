// Live detection readout: the chord the engine hears right now, a confidence
// bar, and a 12-bin chroma visualizer. Honest about uncertainty (spec §3):
// low confidence shows "—" / "not sure" rather than asserting a wrong chord.

import type { LiveDetection } from "../engine/playEvent";

const PC_LABELS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export function LiveChord({ live }: { live: LiveDetection | null }) {
  const chord = live?.chord ?? null;
  const conf = live?.confidence ?? 0;
  const chroma = live?.chroma;
  const confPct = Math.round(conf * 100);

  return (
    <div className="livechord">
      <div className={`lc-name ${chord ? "" : "muted"}`}>
        {chord ?? (conf > 0 ? "?" : "—")}
      </div>
      <div className="lc-conf" aria-label="confidence">
        <div
          className={`lc-conf-fill ${conf >= 0.6 ? "ok" : "low"}`}
          style={{ width: `${confPct}%` }}
        />
      </div>
      <div className="lc-conf-label muted">
        {chord
          ? `${confPct}% confident`
          : conf > 0
            ? "not sure — strum cleanly"
            : "listening…"}
      </div>
      {chroma && (
        <div className="chroma">
          {PC_LABELS.map((l, i) => (
            <div key={l} className="chroma-col" title={l}>
              <div
                className="chroma-bar"
                style={{ height: `${Math.round(chroma[i] * 100)}%` }}
              />
              <span className="chroma-lbl">{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
