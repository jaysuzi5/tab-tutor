// THE DSP↔LLM CONTRACT. The listening engine emits PlayEvents; the scorer
// aggregates them into a SessionSummary; only the summary ever reaches Groq.
// Versioned — bump SCHEMA_VERSION on any breaking change and migrate.

export const SCHEMA_VERSION = 1;

export interface PlayEvent {
  v: number; // SCHEMA_VERSION
  t: number; // session seconds since practice start
  expected: string | null; // target chord at this moment (null in free-detect)
  detected: string | null; // chord the engine heard (null if unsure/silent)
  onsetMs: number; // ms from practice start to this strum onset
  timingErrMs: number | null; // +late / -early vs tempo grid (null until step 4)
  inTune: boolean | null; // monophonic tuning check, when available
  centsOff: number | null;
  confidence: number; // 0..1; low => tutor asks rather than asserts
}

export interface LiveDetection {
  chord: string | null;
  confidence: number;
  chroma: Float32Array; // 12 pitch-class bins, for the live visualizer
  runnerUp: string | null;
}

export function makeEvent(p: Omit<PlayEvent, "v">): PlayEvent {
  return { v: SCHEMA_VERSION, ...p };
}
