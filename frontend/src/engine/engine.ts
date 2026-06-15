// PracticeEngine: the single per-frame DSP pass over one mic analyser.
// Produces (a) a monophonic pitch read for the tuner, (b) a smoothed live
// chord detection for the on-screen highlight, and (c) discrete PlayEvents on
// strum onsets. Raw audio stays here — only PlayEvents leave the engine.

import { PitchTracker, type PitchResult } from "./pitch";
import { ChromaExtractor } from "./chroma";
import { matchChord } from "./chords";
import { OnsetDetector } from "./onset";
import { rms } from "./mic";
import { makeEvent, type LiveDetection, type PlayEvent } from "./playEvent";

const SMOOTH_FRAMES = 5; // ~80ms majority vote stabilizes the live chord
// After a strum onset, wait for the pick-attack transient to pass and the notes
// to ring before sampling the chord for the scored PlayEvent. Sampling AT the
// onset caught the noisy transient (or the dying previous chord) -> false misses.
const SETTLE_MS = 110;

interface Vote {
  chord: string | null;
  conf: number;
}

// Majority vote over a set of per-frame matches; confidence = mean of the
// frames that agreed with the winner.
function voteChord(votes: Vote[], minFrac = 0.5): Vote {
  const counts = new Map<string, { n: number; sum: number }>();
  for (const v of votes) {
    if (!v.chord) continue;
    const c = counts.get(v.chord) ?? { n: 0, sum: 0 };
    c.n++;
    c.sum += v.conf;
    counts.set(v.chord, c);
  }
  let best: string | null = null,
    bestN = 0,
    bestConf = 0;
  for (const [chord, c] of counts) {
    if (c.n > bestN) {
      bestN = c.n;
      best = chord;
      bestConf = c.sum / c.n;
    }
  }
  const need = Math.max(1, Math.ceil(votes.length * minFrac));
  return bestN >= need ? { chord: best, conf: bestConf } : { chord: null, conf: bestConf };
}

export interface EngineFrame {
  pitch: PitchResult;
  live: LiveDetection;
}

export class PracticeEngine {
  private pitch: PitchTracker;
  private chroma: ChromaExtractor;
  private onset: OnsetDetector;
  private buf: Float32Array<ArrayBuffer>;
  private chromaVec = new Float32Array(12);
  private history: Vote[] = [];
  private startMs: number;
  // Open settle window after an onset (captured at onset; emitted once settled).
  private pending: {
    onsetMs: number;
    expected: string | null;
    timingErrMs: number | null;
    inTune: boolean | null;
    centsOff: number | null;
  } | null = null;
  private settleVotes: Vote[] = [];

  // Practice context, settable by the UI as the song/cursor advances.
  expected: string | null = null;
  onEvent: ((e: PlayEvent) => void) | null = null;
  // Supplied by the metronome: onset-vs-beat error in ms (null when no clock).
  timingFn: ((onsetMs: number) => number | null) | null = null;

  constructor(
    private analyser: AnalyserNode,
    sampleRate: number,
    startMs: number,
  ) {
    this.pitch = new PitchTracker(analyser, sampleRate);
    this.chroma = new ChromaExtractor(analyser, sampleRate);
    this.onset = new OnsetDetector();
    this.buf = new Float32Array(analyser.fftSize);
    this.startMs = startMs;
  }

  private smoothed(): LiveDetection {
    const v = voteChord(this.history, 0.5);
    return {
      chord: v.chord,
      confidence: v.chord ? v.conf : 0,
      chroma: this.chromaVec,
      runnerUp: null,
    };
  }

  read(nowMs: number): EngineFrame {
    const pitch = this.pitch.read();

    this.analyser.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf);
    this.chroma.compute(this.chromaVec);
    const match = matchChord(this.chromaVec);

    this.history.push({ chord: match.chord, conf: match.confidence });
    if (this.history.length > SMOOTH_FRAMES) this.history.shift();

    // A new strum opens a settle window. Expected/timing are captured NOW (at
    // the attack), but the detected chord is voted from the frames that follow,
    // once the pick transient has passed and the strings ring.
    if (this.onset.detect(level, nowMs)) {
      this.pending = {
        onsetMs: nowMs,
        expected: this.expected,
        timingErrMs: this.timingFn?.(nowMs) ?? null,
        inTune: pitch.reading ? Math.abs(pitch.reading.cents) <= 8 : null,
        centsOff: pitch.reading?.cents ?? null,
      };
      this.settleVotes = [];
    }

    if (this.pending) {
      this.settleVotes.push({ chord: match.chord, conf: match.confidence });
      if (nowMs - this.pending.onsetMs >= SETTLE_MS) {
        const v = voteChord(this.settleVotes, 0.4);
        const p = this.pending;
        this.onEvent?.(
          makeEvent({
            t: (p.onsetMs - this.startMs) / 1000,
            expected: p.expected,
            detected: v.chord,
            onsetMs: p.onsetMs - this.startMs,
            timingErrMs: p.timingErrMs,
            inTune: p.inTune,
            centsOff: p.centsOff,
            confidence: v.conf,
          }),
        );
        this.pending = null;
        this.settleVotes = [];
      }
    }

    return { pitch, live: this.smoothed() };
  }
}
