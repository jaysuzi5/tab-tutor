// Real-time monophonic pitch detection (pitchy / McLeod). Drives the tuner
// and single-note feedback. Chord detection (chroma) lives separately.

import { PitchDetector } from "pitchy";
import { rms } from "./mic";
import { freqToNote, type NoteReading } from "./notes";

export interface PitchResult {
  freq: number | null;
  clarity: number; // 0..1 confidence from pitchy
  level: number; // input RMS, for silence gating
  reading: NoteReading | null;
}

// Tunable thresholds — mic/guitar/room vary wildly (see CLAUDE spec §3).
export interface PitchConfig {
  clarityMin: number; // reject noisy/ambiguous frames
  levelMin: number; // silence gate
  minFreq: number; // guitar low E2 ~82Hz; ignore subsonic rumble
  maxFreq: number;
}

export const DEFAULT_PITCH_CONFIG: PitchConfig = {
  clarityMin: 0.9,
  levelMin: 0.01,
  minFreq: 70,
  maxFreq: 1500,
};

export class PitchTracker {
  private detector: PitchDetector<Float32Array<ArrayBuffer>>;
  private buf: Float32Array<ArrayBuffer>;
  constructor(
    private analyser: AnalyserNode,
    private sampleRate: number,
    private cfg: PitchConfig = DEFAULT_PITCH_CONFIG,
  ) {
    this.detector = PitchDetector.forFloat32Array(analyser.fftSize);
    this.buf = new Float32Array(analyser.fftSize);
  }

  setConfig(cfg: Partial<PitchConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  read(): PitchResult {
    this.analyser.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf);
    if (level < this.cfg.levelMin) {
      return { freq: null, clarity: 0, level, reading: null };
    }
    const [freq, clarity] = this.detector.findPitch(this.buf, this.sampleRate);
    const ok =
      clarity >= this.cfg.clarityMin &&
      freq >= this.cfg.minFreq &&
      freq <= this.cfg.maxFreq;
    if (!ok) return { freq: null, clarity, level, reading: null };
    return { freq, clarity, level, reading: freqToNote(freq) };
  }
}
