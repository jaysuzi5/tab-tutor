import { useEffect, useState } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import { nearestString } from "../engine/notes";
import { Headstock } from "../ui/Headstock";
import { Tuner } from "../ui/Tuner";
import { EnablePanel } from "../ui/EnablePanel";
import type { EnableState } from "../App";

const IN_TUNE = 5; // cents

export function TunerPage({
  mic,
  sp,
  enable,
}: {
  mic: MicApi;
  sp: SpotifyApi;
  enable: EnableState;
}) {
  const { status, frame } = mic;
  const running = status === "running";
  const reading = frame?.pitch.reading ?? null;
  const target = reading ? nearestString(reading.freq) : null;
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (reading && Math.abs(reading.cents) <= IN_TUNE) {
      const t = nearestString(reading.freq);
      setConfirmed((s) => (s.has(t.label) ? s : new Set(s).add(t.label)));
    }
  }, [frame, reading]);

  const allInTune = confirmed.size === 6;

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Tuner — standard tuning (E A D G B E)</h2>
          <p className="muted">
            Play each open string. A peg turns <span className="ok">green</span>{" "}
            when that string is in tune.
          </p>

          {!running ? (
            <p className="muted">Enable the mic (right) to start tuning.</p>
          ) : (
            <>
              <Headstock active={target?.label ?? null} confirmed={confirmed} />
              <Tuner result={frame?.pitch ?? null} />
              {allInTune ? (
                <p className="ok tuner-done">✓ All six strings in tune!</p>
              ) : (
                <p className="muted">{confirmed.size}/6 strings in tune</p>
              )}
              <button className="ghost" onClick={() => setConfirmed(new Set())}>
                Reset
              </button>
            </>
          )}
        </div>
      </section>

      <aside className="right">
        <EnablePanel mic={mic} sp={sp} {...enable} />
      </aside>
    </main>
  );
}
