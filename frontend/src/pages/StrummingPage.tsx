// Strumming-pattern practice. A metronome runs an 8th-note grid; the listening
// engine's onset detection captures each strum, and we score WHEN you strummed
// against the pattern's active slots. The mic can't tell down vs up, so arrows
// guide your hand but scoring is about timing/placement, not direction.

import { useEffect, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import { Metronome } from "../engine/clock";

type Sym = "D" | "U" | "";
interface Pattern {
  name: string;
  slots: Sym[]; // 8 slots = one 4/4 bar of 8th notes
}

const PATTERNS: Pattern[] = [
  { name: "Quarters (all down)", slots: ["D", "", "D", "", "D", "", "D", ""] },
  { name: "Eighths (down-up)", slots: ["D", "U", "D", "U", "D", "U", "D", "U"] },
  { name: "Old faithful (D · D U · U D U)", slots: ["D", "", "D", "U", "", "U", "D", "U"] },
  { name: "D D U · U D U", slots: ["D", "", "D", "U", "", "U", "D", ""] },
];

const COUNT = ["1", "&", "2", "&", "3", "&", "4", "&"];
const ARROW = (s: Sym) => (s === "D" ? "↓" : s === "U" ? "↑" : "·");

interface Stats {
  hits: number;
  expected: number;
  extras: number;
  timingSum: number;
  timingN: number;
}
const ZERO: Stats = { hits: 0, expected: 0, extras: 0, timingSum: 0, timingN: 0 };

export function StrummingPage({ mic }: { mic: MicApi }) {
  const { status, setTiming } = mic;
  const running = status === "running";

  const [patternIdx, setPatternIdx] = useState(2);
  const [custom, setCustom] = useState<Sym[]>(["D", "", "D", "U", "", "U", "D", "U"]);
  const isCustom = patternIdx === PATTERNS.length;
  const [tempo, setTempo] = useState(80);
  const [active, setActive] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [cursor, setCursor] = useState(-1);
  const [fx, setFx] = useState<("" | "hit" | "miss")[]>(Array(8).fill(""));
  const [stats, setStats] = useState<Stats>(ZERO);
  const [result, setResult] = useState<Stats | null>(null);

  const pattern: Pattern = isCustom
    ? { name: "Custom", slots: custom }
    : PATTERNS[patternIdx];
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  // Cycle a custom slot: down -> up -> rest -> down.
  const cycleSlot = (i: number) =>
    setCustom((c) => c.map((s, idx) => (idx === i ? (s === "D" ? "U" : s === "U" ? "" : "D") : s)));

  const metroRef = useRef<Metronome>(new Metronome());
  const strumsRef = useRef<{ slot: number; errMs: number }[]>([]);
  const lastEvalRef = useRef(0);
  const statsRef = useRef<Stats>({ ...ZERO });
  const fxRef = useRef<("" | "hit" | "miss")[]>(Array(8).fill(""));
  const rafRef = useRef(0);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    metroRef.current.stop();
    setTiming(null);
    setActive(false);
    setCursor(-1);
    setCountIn(0);
    setResult({ ...statsRef.current });
  };

  const startSession = () => {
    setResult(null);
    statsRef.current = { ...ZERO };
    setStats({ ...ZERO });
    strumsRef.current = [];
    lastEvalRef.current = 0;
    fxRef.current = Array(8).fill("");
    setFx(Array(8).fill(""));
    const m = metroRef.current;
    m.start(tempo, 4);
    // Record every strum onset onto the 8th-note grid (perf-clock aligned).
    setTiming((onsetPerf) => {
      const e = m.nearestEighth(onsetPerf);
      if (e && e.slot >= 0) strumsRef.current.push(e);
      return e ? e.errMs : null;
    });
    setActive(true);
    rafRef.current = requestAnimationFrame(loop);
  };

  const evaluateSlot = (abs: number) => {
    const inBar = ((abs % 8) + 8) % 8;
    if (inBar === 0) {
      fxRef.current = Array(8).fill(""); // new bar — clear marks
    }
    const sym = patternRef.current.slots[inBar];
    const strum = strumsRef.current.find((x) => x.slot === abs);
    const s = statsRef.current;
    if (sym !== "") {
      s.expected++;
      if (strum) {
        s.hits++;
        s.timingSum += Math.abs(strum.errMs);
        s.timingN++;
        fxRef.current[inBar] = "hit";
      } else {
        fxRef.current[inBar] = "miss";
      }
    } else if (strum) {
      s.extras++;
    }
  };

  const loop = () => {
    const m = metroRef.current;
    const now = performance.now();
    if (m.isCountingIn(now)) {
      setCountIn(m.countInRemaining(now));
      setCursor(-1);
    } else {
      setCountIn(0);
      const abs = m.currentEighth(now);
      while (lastEvalRef.current < abs) {
        evaluateSlot(lastEvalRef.current);
        lastEvalRef.current++;
      }
      setCursor(((abs % 8) + 8) % 8);
      setFx([...fxRef.current]);
      setStats({ ...statsRef.current });
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    metroRef.current.stop();
    setTiming(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acc = stats.expected ? Math.round((stats.hits / stats.expected) * 100) : 0;
  const avgMs = stats.timingN ? Math.round(stats.timingSum / stats.timingN) : 0;
  const rAcc = result && result.expected ? Math.round((result.hits / result.expected) * 100) : 0;
  const rAvg = result && result.timingN ? Math.round(result.timingSum / result.timingN) : 0;

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Strumming pattern practice</h2>
          <p className="muted">
            Strum along to the metronome. Arrows show down (↓) / up (↑); the
            engine scores your timing on each beat — keep your hand moving even
            on the rests.
          </p>

          {!running ? (
            <p className="muted">Enable the mic on the Setup tab to start.</p>
          ) : (
            <>
              <div className="strum-controls">
                <select
                  value={patternIdx}
                  onChange={(e) => setPatternIdx(Number(e.target.value))}
                  disabled={active}
                >
                  {PATTERNS.map((p, i) => (
                    <option key={p.name} value={i}>{p.name}</option>
                  ))}
                  <option value={PATTERNS.length}>Custom…</option>
                </select>
                <label className="muted">
                  {tempo} bpm
                  <input
                    type="range"
                    min={50}
                    max={140}
                    value={tempo}
                    disabled={active}
                    onChange={(e) => setTempo(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="strum-grid">
                {pattern.slots.map((s, i) => (
                  <div
                    key={i}
                    className={`strum-cell ${cursor === i ? "cursor" : ""} ${
                      s === "" ? "rest" : ""
                    } ${isCustom && !active ? "editable" : ""} fx-${fx[i]}`}
                    onClick={isCustom && !active ? () => cycleSlot(i) : undefined}
                  >
                    <div className="strum-arrow">{ARROW(s)}</div>
                    <div className="strum-count">{COUNT[i]}</div>
                  </div>
                ))}
              </div>
              {isCustom && !active && (
                <p className="muted small">Tap a cell to cycle ↓ → ↑ → rest.</p>
              )}

              {active ? (
                <div className="strum-live">
                  {countIn > 0 ? (
                    <span className="countin">{countIn}</span>
                  ) : (
                    <span className="muted">
                      {acc}% on-beat · ±{avgMs}ms · {stats.hits}/{stats.expected}
                    </span>
                  )}
                  <button className="stop" onClick={stop}>■ Stop</button>
                </div>
              ) : (
                <div className="strum-start">
                  {result && (
                    <div className="speed-result">
                      <div className="speed-result-big">{rAcc}%</div>
                      <div className="muted">
                        on the beat · ±{rAvg}ms avg ·{" "}
                        {result.hits}/{result.expected} hits
                        {result.extras ? ` · ${result.extras} extra` : ""}
                      </div>
                    </div>
                  )}
                  <button className="speed-start" onClick={startSession}>
                    {result ? "Go again" : "Start"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <aside className="right">
        <div className="panel">
          <h3>Tips</h3>
          <p className="muted small">
            Keep your strumming hand moving down-up continuously like a pendulum
            — even on rests, just miss the strings. That steady motion is what
            makes patterns feel automatic. Start slow; speed comes free.
          </p>
        </div>
      </aside>
    </main>
  );
}
