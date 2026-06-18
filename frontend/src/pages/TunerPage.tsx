import { useEffect, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import { noteToMidi, midiToFreq } from "../engine/notes";
import { Headstock } from "../ui/Headstock";
import { Tuner } from "../ui/Tuner";

const PRESETS: Record<string, string[]> = {
  "Standard (E A D G B E)": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "Drop D (D A D G B E)": ["D2", "A2", "D3", "G3", "B3", "E4"],
  "Half-step down (Eb)": ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
  "Open G (D G D G B D)": ["D2", "G2", "D3", "G3", "B3", "D4"],
  "DADGAD": ["D2", "A2", "D3", "G3", "A3", "D4"],
};

// Strict gates so a ringing/overtone of one string isn't read as another.
const CLARITY_MIN = 0.95;
const LEVEL_MIN = 0.03;
const IN_TUNE_CENTS = 5;
const STABLE_FRAMES = 8; // must hold steady before we confirm

export function TunerPage({ mic }: { mic: MicApi }) {
  const { status, frame } = mic;
  const running = status === "running";
  const [preset, setPreset] = useState("Standard (E A D G B E)");
  const [tuning, setTuning] = useState<string[]>(PRESETS["Standard (E A D G B E)"]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const stableRef = useRef<{ idx: number; n: number }>({ idx: -1, n: 0 });

  const targets = tuning.map((t) => {
    const midi = noteToMidi(t);
    return midi != null ? midiToFreq(midi) : null;
  });

  const applyPreset = (name: string) => {
    setPreset(name);
    if (PRESETS[name]) setTuning(PRESETS[name]);
    setConfirmed(new Set());
  };
  const editString = (i: number, v: string) => {
    setTuning((t) => t.map((s, idx) => (idx === i ? v : s)));
    setPreset("Custom");
    setConfirmed(new Set());
  };

  useEffect(() => {
    const p = frame?.pitch;
    const reading = p?.reading ?? null;
    if (!reading || !p || p.clarity < CLARITY_MIN || p.level < LEVEL_MIN) {
      setActiveIdx(null);
      stableRef.current = { idx: -1, n: 0 };
      return;
    }
    // Nearest target by cents distance.
    let best = -1, bestCents = Infinity;
    targets.forEach((f, i) => {
      if (f == null) return;
      const cents = Math.abs(1200 * Math.log2(reading.freq / f));
      if (cents < bestCents) {
        bestCents = cents;
        best = i;
      }
    });
    setActiveIdx(best);
    if (bestCents <= IN_TUNE_CENTS) {
      const s = stableRef.current;
      s.n = s.idx === best ? s.n + 1 : 1;
      s.idx = best;
      if (s.n >= STABLE_FRAMES) {
        setConfirmed((c) => (c.has(best) ? c : new Set(c).add(best)));
      }
    } else {
      stableRef.current = { idx: best, n: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  const allInTune = confirmed.size === 6;

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Tuner</h2>
          <p className="muted">
            Play each open string. A peg turns <span className="ok">green</span>{" "}
            once it holds in tune.
          </p>
          {!running ? (
            <p className="muted">Enable the mic on the Setup tab to start tuning.</p>
          ) : (
            <>
              <Headstock
                strings={tuning}
                activeIndex={activeIdx}
                confirmed={confirmed}
              />
              <Tuner result={frame?.pitch ?? null} />
              {allInTune ? (
                <p className="ok tuner-done">✓ All six strings in tune!</p>
              ) : (
                <p className="muted">{confirmed.size}/6 strings in tune</p>
              )}
              <button className="ghost" onClick={() => setConfirmed(new Set())}>Reset</button>
            </>
          )}
        </div>
      </section>

      <aside className="right">
        <div className="panel">
          <h3>Tuning</h3>
          <select
            className="tuning-preset"
            value={PRESETS[preset] ? preset : "Custom"}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {Object.keys(PRESETS).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value="Custom">Custom</option>
          </select>
          <div className="tuning-inputs">
            {tuning.map((s, i) => (
              <input
                key={i}
                value={s}
                onChange={(e) => editString(i, e.target.value)}
                className={targets[i] == null ? "bad" : ""}
                aria-label={`string ${i + 1}`}
              />
            ))}
          </div>
          <p className="muted small">Low → high. Edit any string for a custom tuning.</p>
        </div>
      </aside>
    </main>
  );
}
