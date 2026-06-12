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
  private history: { chord: string | null; conf: number }[] = [];
  private startMs: number;

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
    // Majority vote over recent frames; confidence = mean of agreeing frames.
    const counts = new Map<string, { n: number; sum: number }>();
    for (const h of this.history) {
      if (!h.chord) continue;
      const c = counts.get(h.chord) ?? { n: 0, sum: 0 };
      c.n++;
      c.sum += h.conf;
      counts.set(h.chord, c);
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
    return {
      chord: bestN >= Math.ceil(SMOOTH_FRAMES / 2) ? best : null,
      confidence: best ? bestConf : 0,
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

    if (this.onset.detect(level, nowMs)) {
      const live = this.smoothed();
      const detected = live.chord ?? match.chord;
      const conf = live.chord ? live.confidence : match.confidence;
      this.onEvent?.(
        makeEvent({
          t: (nowMs - this.startMs) / 1000,
          expected: this.expected,
          detected,
          onsetMs: nowMs - this.startMs,
          timingErrMs: this.timingFn?.(nowMs) ?? null,
          inTune: pitch.reading ? Math.abs(pitch.reading.cents) <= 8 : null,
          centsOff: pitch.reading?.cents ?? null,
          confidence: conf,
        }),
      );
    }

    return { pitch, live: this.smoothed() };
  }
}
