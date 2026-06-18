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
  onProgress,
  onStop,
  offsetBeats = 0,
}: {
  chordpro: string;
  tempo: number;
  mode: Mode;
  drillStart: number;
  setExpected: (c: string | null) => void;
  setTiming: (fn: ((onsetMs: number) => number | null) | null) => void;
  onCursor: (idx: number) => void;
  onProgress?: (p: number) => void; // 0..1 through the song (continuous scroll)
  onStop?: () => void; // fired on stop AND end-of-song (e.g. pause Spotify)
  offsetBeats?: number; // per-song sync nudge
}) {
  const tl = useMemo(() => buildTimeline(chordpro), [chordpro]);
  const metroRef = useRef<Metronome>(new Metronome());
  const rafRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [done, setDone] = useState(false);

  const cfgRef = useRef({ tempo, mode, drillStart, offsetBeats });
  cfgRef.current = { tempo, mode, drillStart, offsetBeats };

  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // Fired once when the count-in ends and music begins (start the backing track
  // here so the song + autoscroll begin together, after the 4-count).
  const onMusicStartRef = useRef<(() => void) | null>(null);
  const muteAfterCountInRef = useRef(false);
  const musicStartedRef = useRef(false);

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
    onStopRef.current?.();
  };

  const loop = useCallback(() => {
    const m = metroRef.current;
    const now = performance.now();
    if (m.isCountingIn(now)) {
      setCountIn(m.countInRemaining(now));
      setExpected(null);
      onCursor(-1);
    } else {
      if (!musicStartedRef.current) {
        musicStartedRef.current = true;
        if (muteAfterCountInRef.current) m.muted = true;
        onMusicStartRef.current?.(); // e.g. start the Spotify track now
      }
      setCountIn(0);
      const { mode, drillStart, offsetBeats } = cfgRef.current;
      const beat = m.currentMusicBeat(now) + offsetBeats;
      const total = tl.chords.length * tl.beatsPerChord;
      // Play-through runs once to the end and stops; Drill loops a window.
      if (mode === "playthrough") {
        const seg = Math.floor(Math.max(0, beat) / tl.beatsPerChord);
        if (seg >= tl.chords.length) {
          endSongRef.current();
          return; // stop scheduling — song finished
        }
        setExpected(tl.chords[seg] ?? null);
        onCursor(seg);
      } else {
        const win = { start: drillStart, end: Math.min(drillStart + 2, tl.chords.length) };
        const idx = chordIndexAt(tl, Math.max(0, beat), win);
        setExpected(tl.chords[idx] ?? null);
        onCursor(idx);
      }
      onProgressRef.current?.(total ? Math.max(0, Math.min(1, beat / total)) : 0);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [tl, setExpected, onCursor]);

  const play = useCallback(
    (opts?: { onMusicStart?: () => void; muteAfterCountIn?: boolean }) => {
      const m = metroRef.current;
      // Always a 4-beat count-in; clicks audible during it. For Spotify runs we
      // mute the clicks once the track starts (the recording carries the time).
      m.muted = false;
      onMusicStartRef.current = opts?.onMusicStart ?? null;
      muteAfterCountInRef.current = opts?.muteAfterCountIn ?? false;
      musicStartedRef.current = false;
      m.start(cfgRef.current.tempo, 4);
      setTiming((onset) => m.timingErrMs(onset));
      setPlaying(true);
      setDone(false);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    },
    [loop, setTiming],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    metroRef.current.stop();
    setTiming(null);
    setExpected(null);
    onCursor(-1);
    setPlaying(false);
    setCountIn(0);
    setDone(false);
    onStopRef.current?.(); // stop the backing track too
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
