// Tuner — reuses the exact pitch-detection code (spec §2: a near-free first
// win). Shows nearest note, cents offset, and the closest guitar string.

import { nearestString } from "../engine/notes";
import type { PitchResult } from "../engine/pitch";

const IN_TUNE_CENTS = 5;

export function Tuner({ result }: { result: PitchResult | null }) {
  const reading = result?.reading ?? null;
  const cents = reading?.cents ?? 0;
  const inTune = reading != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const target = reading ? nearestString(reading.freq) : null;
  // Needle position -50..+50 cents -> 0..100%.
  const pos = Math.max(0, Math.min(100, ((cents + 50) / 100) * 100));

  return (
    <div className={`tuner ${inTune ? "in-tune" : ""}`}>
      <div className="tuner-note">
        {reading ? (
          <>
            <span className="note-name">{reading.note}</span>
            <span className="note-oct">{reading.octave}</span>
          </>
        ) : (
          <span className="note-name muted">—</span>
        )}
      </div>
      <div className="tuner-gauge">
        <div className="tuner-center" />
        <div
          className="tuner-needle"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="tuner-info">
        {reading ? (
          <>
            <span>{cents > 0 ? `+${cents}` : cents} cents</span>
            {target && (
              <span className="muted">
                {" "}
                · nearest string {target.label}{" "}
                {inTune ? "✓ in tune" : cents > 0 ? "↓ tune down" : "↑ tune up"}
              </span>
            )}
          </>
        ) : (
          <span className="muted">play a single string…</span>
        )}
      </div>
    </div>
  );
}
