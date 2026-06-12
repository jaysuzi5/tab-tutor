// First-run calibration: mic permission + input-level check. Confirms the
// engine hears the guitar before any practice (spec §2). The one-chord listen
// arrives in step 2 once chord detection exists.

import type { MicStatus } from "../engine/useMic";
import type { PitchResult } from "../engine/pitch";
import { MicPrivacyNote } from "./MicPrivacyNote";

export function Calibration({
  status,
  result,
  onStart,
}: {
  status: MicStatus;
  result: PitchResult | null;
  onStart: () => void;
}) {
  const level = result?.level ?? 0;
  const levelPct = Math.min(100, level * 600); // visual scaling

  if (status === "unsupported") {
    return (
      <div className="calib">
        <h3>Mic unavailable</h3>
        <p className="muted">
          Your browser can't access the mic here. The mic needs a secure
          context — use <code>localhost</code> in dev, or an HTTPS host in
          production. You can still view charts and use the metronome.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="calib">
        <h3>Mic permission denied</h3>
        <p className="muted">
          No problem — you can still follow the chart and metronome. Allow the
          mic in your browser settings to get live listening and the tuner.
        </p>
        <button onClick={onStart}>Try again</button>
      </div>
    );
  }

  if (status === "idle" || status === "starting") {
    return (
      <div className="calib">
        <h3>Let's hear your guitar</h3>
        <MicPrivacyNote />
        <button onClick={onStart} disabled={status === "starting"}>
          {status === "starting" ? "Starting…" : "Enable mic"}
        </button>
      </div>
    );
  }

  // running
  return (
    <div className="calib">
      <h3>Mic on — strum to check the level</h3>
      <div className="level-meter" aria-label="input level">
        <div className="level-fill" style={{ width: `${levelPct}%` }} />
      </div>
      <p className="muted">
        {level > 0.02
          ? "Got it — I can hear you. 🎸"
          : "Play a string… I'm listening."}
      </p>
    </div>
  );
}
