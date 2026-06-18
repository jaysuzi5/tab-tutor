// Chords: pick the chords to work on, then either Practice (untimed, optional
// auto-advance when the correct chord is heard) or Timed (count clean changes
// against a countdown). Both advance on a fresh strum that matches the target.

import { useEffect, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import { KNOWN_CHORDS } from "../engine/chords";
import { ChordDiagram } from "../ui/ChordDiagram";
import { LiveChord } from "../ui/LiveChord";
import { TutorPanel } from "../ui/TutorPanel";
import { playChord } from "../engine/chordAudio";
import { useTutor } from "../engine/useTutor";

const DURATIONS = [30, 60, 120];
const STRUM_WINDOW_MS = 800;

function pickNext(pool: string[], prev: string | null): string {
  if (pool.length === 1) return pool[0];
  let n = pool[Math.floor(Math.random() * pool.length)];
  while (n === prev) n = pool[Math.floor(Math.random() * pool.length)];
  return n;
}

export function ChordsPage({ mic }: { mic: MicApi }) {
  const { status, frame, events, summary, setExpected } = mic;
  const running = status === "running";

  const [selected, setSelected] = useState<string[]>(["G", "C", "D", "Em"]);
  const [mode, setMode] = useState<"practice" | "timed">("practice");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const tutor = useTutor("chord-practice", "practice", summary, running);

  const [target, setTarget] = useState<string | null>(null);
  const [got, setGot] = useState(false);
  const [count, setCount] = useState(0);

  // Timed session
  const [active, setActive] = useState(false);
  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<{ count: number; duration: number } | null>(null);

  const lastOnsetMsRef = useRef(-1);
  const windowUntilRef = useRef(0);

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  // Practice mode: keep a target while running.
  useEffect(() => {
    if (mode === "practice" && running && selected.length && !target) {
      setTarget(pickNext(selected, null));
      setGot(false);
    }
    if (!running || (mode === "practice" && !selected.length)) setTarget(null);
  }, [mode, running, selected, target]);

  useEffect(() => {
    setExpected(running && target ? target : null);
    return () => setExpected(null);
  }, [running, target, setExpected]);

  // Fresh strum opens the match window.
  useEffect(() => {
    if (!events.length) return;
    const latest = events[events.length - 1].onsetMs;
    if (latest > lastOnsetMsRef.current) {
      lastOnsetMsRef.current = latest;
      windowUntilRef.current = performance.now() + STRUM_WINDOW_MS;
    }
  }, [events]);

  // Correct chord on a fresh strum -> advance (or mark got, in manual practice).
  useEffect(() => {
    if (!running || !target || got) return;
    const sessionLive = mode === "timed" ? active : true;
    if (!sessionLive) return;
    if (frame?.live.chord === target && performance.now() < windowUntilRef.current) {
      windowUntilRef.current = 0;
      if (mode === "timed" || autoAdvance) {
        setCount((c) => c + 1);
        setTarget((t) => pickNext(selected, t));
      } else {
        setGot(true);
      }
    }
  }, [frame, running, target, got, mode, active, autoAdvance, selected]);

  const nextManual = () => {
    setGot(false);
    setTarget((t) => pickNext(selected, t));
  };

  // Timed countdown
  useEffect(() => {
    if (!active) return;
    if (timeLeft <= 0) {
      setActive(false);
      setResult({ count, duration });
      setTarget(null);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, timeLeft]);

  const startTimed = () => {
    setResult(null);
    setCount(0);
    setTimeLeft(duration);
    setGot(false);
    lastOnsetMsRef.current = events.length ? events[events.length - 1].onsetMs : -1;
    windowUntilRef.current = 0;
    setTarget(pickNext(selected, null));
    setActive(true);
  };
  const perMin = result && result.duration ? Math.round((result.count / result.duration) * 60) : 0;

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Chords</h2>

          <div className="mode-switch" style={{ justifyContent: "center" }}>
            <button className={`mode-btn ${mode === "practice" ? "active" : ""}`} onClick={() => setMode("practice")}>Practice</button>
            <button className={`mode-btn ${mode === "timed" ? "active" : ""}`} onClick={() => setMode("timed")}>Timed</button>
          </div>

          <div className="chord-select">
            {KNOWN_CHORDS.map((c) => (
              <button
                key={c}
                className={`chip ${selected.includes(c) ? "active" : ""}`}
                onClick={() => toggle(c)}
                onDoubleClick={() => playChord(c)}
                title="Click to add/remove · double-click to hear"
              >
                {c}
              </button>
            ))}
          </div>

          {!running ? (
            <p className="muted">Enable the mic on the Setup tab to start.</p>
          ) : selected.length === 0 ? (
            <p className="muted">Pick at least one chord above.</p>
          ) : mode === "practice" ? (
            <>
              <label className="enable-row" style={{ justifyContent: "center" }}>
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
                <span>Auto-advance when I play it right</span>
              </label>
              {target && (
                <div className="speed-run">
                  <div className={`speed-target ${got ? "got" : ""}`}>{target}</div>
                  <ChordDiagram chord={target} />
                  {got ? (
                    <div className="trainer-status">
                      <span className="ok">✓ nice!</span>
                      <button onClick={nextManual}>Next chord</button>
                    </div>
                  ) : (
                    <p className="muted">{frame?.live.chord ? `hearing: ${frame.live.chord}` : "strum it"}</p>
                  )}
                  <p className="muted small">{count} correct so far</p>
                </div>
              )}
            </>
          ) : !active ? (
            <div className="speed-start">
              {result && (
                <div className="speed-result">
                  <div className="speed-result-big">{result.count}</div>
                  <div className="muted">correct in {result.duration}s · <strong>{perMin}/min</strong></div>
                </div>
              )}
              <label className="muted">Session length</label>
              <div className="duration-pick">
                {DURATIONS.map((d) => (
                  <button key={d} className={`mode-btn ${duration === d ? "active" : ""}`} onClick={() => setDuration(d)}>{d}s</button>
                ))}
              </div>
              <button className="speed-start" onClick={startTimed}>{result ? "Go again" : "Start"}</button>
            </div>
          ) : (
            <div className="speed-run">
              <div className="speed-stats">
                <div><div className="speed-num">{count}</div><div className="muted">correct</div></div>
                <div><div className={`speed-num ${timeLeft <= 5 ? "warn" : ""}`}>{timeLeft}</div><div className="muted">seconds left</div></div>
              </div>
              {target && <><div className="speed-target">{target}</div><ChordDiagram chord={target} /></>}
              <p className="muted">{frame?.live.chord ? `hearing: ${frame.live.chord}` : "strum the chord shown"}</p>
              <button className="stop" onClick={() => { setActive(false); setResult({ count, duration }); setTarget(null); }}>■ End</button>
            </div>
          )}
        </div>
      </section>

      <aside className="right">
        <div className="panel">
          <h3>Tutor</h3>
          <TutorPanel text={tutor.text} busy={tutor.busy} tokens={tutor.tokens} onCoach={tutor.coach} onAsk={tutor.ask} />
        </div>
        {running && (
          <div className="panel">
            <h3>Now hearing</h3>
            <LiveChord live={frame?.live ?? null} />
          </div>
        )}
      </aside>
    </main>
  );
}
