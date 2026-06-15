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
  const [done, setDone] = useState(false);

  const cfgRef = useRef({ tempo, mode, drillStart });
  cfgRef.current = { tempo, mode, drillStart };

  // Called when Play-through reaches the last chord: stop transport but leave
  // the cursor on the final chord. Kept in a ref so the loop's deps stay stable.
  const endSongRef = useRef<() => void>(() => {});
  endSongRef.current = () => {
    cancelAnimationFrame(rafRef.current);
    metroRef.current.stop();
    setTiming(null);
    setExpected(null);
    setPlaying(false);
    setCountIn(0);
    setDone(true);
  };

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
      // Play-through runs once to the end and stops; Drill loops a window.
      if (mode === "playthrough") {
        const seg = Math.floor(beat / tl.beatsPerChord);
        if (seg >= tl.chords.length) {
          endSongRef.current();
          return; // stop scheduling — song finished
        }
        setExpected(tl.chords[seg] ?? null);
        onCursor(seg);
      } else {
        const win = { start: drillStart, end: Math.min(drillStart + 2, tl.chords.length) };
        const idx = chordIndexAt(tl, beat, win);
        setExpected(tl.chords[idx] ?? null);
        onCursor(idx);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [tl, setExpected, onCursor]);

  const play = useCallback(() => {
    const m = metroRef.current;
    m.start(cfgRef.current.tempo, 4);
    setTiming((onset) => m.timingErrMs(onset));
    setPlaying(true);
    setDone(false);
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
    setDone(false);
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

  return { playing, countIn, done, play, stop, timeline: tl };
}
