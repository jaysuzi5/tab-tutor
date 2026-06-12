// React hook: owns mic lifecycle + the single requestAnimationFrame DSP loop
// driving PracticeEngine. Exposes the live frame (tuner + chord highlight),
// the PlayEvent stream, and the running SessionSummary. <~100ms feedback.

import { useCallback, useEffect, useRef, useState } from "react";
import { startMic, micSupported, type MicStream } from "./mic";
import { PracticeEngine, type EngineFrame } from "./engine";
import { Scorer, type SessionSummary } from "./scorer";
import type { PlayEvent } from "./playEvent";

export type MicStatus = "idle" | "starting" | "running" | "denied" | "unsupported";

export function useMic() {
  const [status, setStatus] = useState<MicStatus>(
    micSupported() ? "idle" : "unsupported",
  );
  const [frame, setFrame] = useState<EngineFrame | null>(null);
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const micRef = useRef<MicStream | null>(null);
  const engineRef = useRef<PracticeEngine | null>(null);
  const scorerRef = useRef<Scorer | null>(null);
  const rafRef = useRef<number>(0);

  const loop = useCallback(() => {
    const eng = engineRef.current;
    if (eng) setFrame(eng.read(performance.now()));
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    if (!micSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus("starting");
    try {
      const mic = await startMic();
      micRef.current = mic;
      const scorer = new Scorer(null, "free", null);
      scorerRef.current = scorer;
      const eng = new PracticeEngine(
        mic.analyser,
        mic.ctx.sampleRate,
        performance.now(),
      );
      eng.onEvent = (e) => {
        scorer.ingest(e);
        setEvents((prev) => [...prev.slice(-49), e]);
        setSummary(scorer.summary());
      };
      engineRef.current = eng;
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setStatus("denied");
    }
  }, [loop]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    micRef.current?.stop();
    micRef.current = null;
    engineRef.current = null;
    scorerRef.current = null;
    setFrame(null);
    setStatus("idle");
  }, []);

  // Lets the UI tell the engine which chord is currently the target.
  const setExpected = useCallback((chord: string | null) => {
    if (engineRef.current) engineRef.current.expected = chord;
  }, []);

  // Metronome supplies onset-vs-beat timing error to the engine.
  const setTiming = useCallback((fn: ((onsetMs: number) => number | null) | null) => {
    if (engineRef.current) engineRef.current.timingFn = fn;
  }, []);

  // Mode/tempo context for the scorer (drives the SessionSummary the tutor sees).
  const setMode = useCallback((mode: string, tempoTarget: number | null) => {
    if (scorerRef.current) {
      scorerRef.current.mode = mode;
      scorerRef.current.tempoTarget = tempoTarget;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { status, frame, events, summary, start, stop, setExpected, setTiming, setMode };
}
