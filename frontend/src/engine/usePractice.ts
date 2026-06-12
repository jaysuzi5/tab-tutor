// Drives clock-based modes (Play-through, Drill): runs the metronome, advances
// the cursor at tempo, sets the engine's expected chord + timing reference.
// Learn mode is clockless (the ChordTrainer handles it).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Metronome } from "./clock";
import { buildTimeline, chordIndexAt } from "./timeline";

export type Mode = "learn" | "playthrough" | "drill";

export function usePractice({
  chordpro,
  tempo,
  mode,
  drillStart,
  setExpected,
  setTiming,
  onCursor,
}: {
  chordpro: string;
  tempo: number;
  mode: Mode;
  drillStart: number;
  setExpected: (c: string | null) => void;
  setTiming: (fn: ((onsetMs: number) => number | null) | null) => void;
  onCursor: (idx: number) => void;
}) {
  const tl = useMemo(() => buildTimeline(chordpro), [chordpro]);
  const metroRef = useRef<Metronome>(new Metronome());
  const rafRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [countIn, setCountIn] = useState(0);

  const cfgRef = useRef({ tempo, mode, drillStart });
  cfgRef.current = { tempo, mode, drillStart };

  const loop = useCallback(() => {
    const m = metroRef.current;
    const now = performance.now();
    if (m.isCountingIn(now)) {
      setCountIn(m.countInRemaining(now));
      setExpected(null);
      onCursor(-1);
    } else {
      setCountIn(0);
      const beat = m.currentMusicBeat(now);
      const { mode, drillStart } = cfgRef.current;
      const win =
        mode === "drill"
          ? { start: drillStart, end: Math.min(drillStart + 2, tl.chords.length) }
          : undefined;
      const idx = chordIndexAt(tl, beat, win);
      setExpected(tl.chords[idx] ?? null);
      onCursor(idx);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [tl, setExpected, onCursor]);

  const play = useCallback(() => {
    const m = metroRef.current;
    m.start(cfgRef.current.tempo, 4);
    setTiming((onset) => m.timingErrMs(onset));
    setPlaying(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, setTiming]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    metroRef.current.stop();
    setTiming(null);
    setExpected(null);
    onCursor(-1);
    setPlaying(false);
    setCountIn(0);
  }, [setTiming, setExpected, onCursor]);

  // Tempo change while playing re-anchors the grid (restart with count-in).
  useEffect(() => {
    if (playing) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo]);

  // Switching away from a clock mode stops transport.
  useEffect(() => {
    if (mode === "learn") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => () => stop(), [stop]);

  return { playing, countIn, play, stop, timeline: tl };
}
