// Speed trainer: flashes random chords; each time you play the correct one it
// advances. Counts correct changes against a countdown so you can track your
// chord-change speed over time. Uses the same listening engine as Practice.

import { useEffect, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import { LiveChord } from "../ui/LiveChord";
import { Calibration } from "../ui/Calibration";

// Beginner open-chord pool (the cowboy chords the detector handles well).
const POOL = ["G", "C", "D", "Em", "Am", "E", "A", "Dm"];
const DURATIONS = [30, 60, 120];
const HOLD_FRAMES = 3; // brief sustain so a clean strum counts once

function pickNext(prev: string | null): string {
  let n = POOL[Math.floor(Math.random() * POOL.length)];
  while (n === prev) n = POOL[Math.floor(Math.random() * POOL.length)];
  return n;
}

export function SpeedTrainerPage({ mic }: { mic: MicApi }) {
  const { status, frame, start, setExpected } = mic;
  const running = status === "running";

  const [active, setActive] = useState(false);
  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [target, setTarget] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{ count: number; duration: number } | null>(null);
  const [flash, setFlash] = useState(false); // green pulse on a correct change
  const holdRef = useRef(0);

  const startSession = () => {
    setResult(null);
    setCount(0);
    setTimeLeft(duration);
    holdRef.current = 0;
    setTarget(pickNext(null));
    setActive(true);
  };

  const endSession = (final: number) => {
    setActive(false);
    setTarget(null);
    setExpected(null);
    setResult({ count: final, duration });
  };

  // Countdown.
  useEffect(() => {
    if (!active) return;
    if (timeLeft <= 0) {
      endSession(count);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, timeLeft]);

  // Tell the engine what we're listening for (scoring + humble fallback).
  useEffect(() => {
    setExpected(active ? target : null);
    return () => setExpected(null);
  }, [active, target, setExpected]);

  // Advance when the correct chord is heard and held briefly.
  useEffect(() => {
    if (!active || !target) return;
    if (frame?.live.chord === target) {
      holdRef.current++;
      if (holdRef.current >= HOLD_FRAMES) {
        holdRef.current = 0;
        setCount((c) => c + 1);
        setTarget((t) => pickNext(t));
        setFlash(true);
        setTimeout(() => setFlash(false), 200);
      }
    } else {
      holdRef.current = 0;
    }
  }, [frame, active, target]);

  const perMin = result ? Math.round((result.count / result.duration) * 60) : 0;

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Chord change speed trainer</h2>
          <p className="muted">
            Play the chord shown. As soon as the engine hears it, the next random
            chord appears. How many clean changes can you make before time runs out?
          </p>

          {!running ? (
            <Calibration status={status} result={frame?.pitch ?? null} onStart={start} />
          ) : !active ? (
            <div className="speed-setup">
              {result && (
                <div className="speed-result">
                  <div className="speed-result-big">{result.count}</div>
                  <div className="muted">
                    correct changes in {result.duration}s ·{" "}
                    <strong>{perMin}/min</strong>
                  </div>
                </div>
              )}
              <label className="muted">Session length</label>
              <div className="duration-pick">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    className={`mode-btn ${duration === d ? "active" : ""}`}
                    onClick={() => setDuration(d)}
                  >
                    {d}s
                  </button>
                ))}
              </div>
              <button className="speed-start" onClick={startSession}>
                {result ? "Go again" : "Start"}
              </button>
            </div>
          ) : (
            <div className="speed-run">
              <div className="speed-stats">
                <div>
                  <div className="speed-num">{count}</div>
                  <div className="muted">correct</div>
                </div>
                <div>
                  <div className={`speed-num ${timeLeft <= 5 ? "warn" : ""}`}>{timeLeft}</div>
                  <div className="muted">seconds left</div>
                </div>
              </div>
              <div className={`speed-target ${flash ? "got" : ""}`}>{target}</div>
              <p className="muted">
                {frame?.live.chord
                  ? `hearing: ${frame.live.chord}`
                  : "strum the chord shown"}
              </p>
              <button className="stop" onClick={() => endSession(count)}>
                ■ End
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="right">
        {running && (
          <div className="panel">
            <h3>Now hearing</h3>
            <LiveChord live={frame?.live ?? null} />
          </div>
        )}
        <div className="panel">
          <h3>How to improve</h3>
          <p className="muted small">
            Track your <strong>changes/min</strong> over days. Switching cleanly
            between chords — not holding one — is the beginner unlock. Start at
            60s, aim to beat your last score.
          </p>
        </div>
      </aside>
    </main>
  );
}
