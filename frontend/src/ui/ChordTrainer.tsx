// Minimal Learn-style loop to exercise the expected->PlayEvent->scoring path:
// shows a target chord, tells the engine to expect it, and advances when the
// engine hears it held cleanly. Full Learn/Play-through modes come in step 4.

import { useEffect, useRef, useState } from "react";
import type { EngineFrame } from "../engine/engine";
import { ChordDiagram } from "./ChordDiagram";

const HOLD_FRAMES = 8; // sustain the chord briefly to count as "got it"

export function ChordTrainer({
  chords,
  frame,
  setExpected,
  cleanPct,
}: {
  chords: string[];
  frame: EngineFrame | null;
  setExpected: (c: string | null) => void;
  cleanPct: number;
}) {
  const [idx, setIdx] = useState(0);
  const [got, setGot] = useState(false);
  const holdRef = useRef(0);
  const target = chords[idx] ?? null;

  useEffect(() => {
    setExpected(target);
    return () => setExpected(null);
  }, [target, setExpected]);

  useEffect(() => {
    const heard = frame?.live.chord;
    if (!target || got) return;
    if (heard === target) {
      holdRef.current++;
      if (holdRef.current >= HOLD_FRAMES) setGot(true);
    } else {
      holdRef.current = 0;
    }
  }, [frame, target, got]);

  const next = () => {
    setGot(false);
    holdRef.current = 0;
    setIdx((i) => (i + 1) % chords.length);
  };

  if (!target) return null;
  return (
    <div className="trainer">
      <div className="trainer-head">
        <span className="muted">Play this chord:</span>
        <span className="trainer-clean muted">accuracy {cleanPct}%</span>
      </div>
      <div className={`trainer-target ${got ? "got" : ""}`}>{target}</div>
      <div className="trainer-diagram">
        <ChordDiagram chord={target} size={0.85} />
      </div>
      <div className="trainer-status">
        {got ? (
          <>
            <span className="ok">✓ Got it!</span>
            <button onClick={next}>Next chord</button>
          </>
        ) : (
          <span className="muted">
            {frame?.live.chord === target
              ? "hold it…"
              : "strum and hold the shape"}
          </span>
        )}
      </div>
    </div>
  );
}
