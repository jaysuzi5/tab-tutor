// Chroma / Pitch-Class Profile (PCP) extraction from the FFT magnitude
// spectrum. 12 bins, one per pitch class, octave-folded. This is the feature
// the open-chord detector matches against templates. Client-side, real-time.

const A4 = 440;

// Map an FFT bin's center frequency to a pitch class 0..11 (C=0).
function freqPitchClass(freq: number): number {
  const midi = Math.round(69 + 12 * Math.log2(freq / A4));
  return ((midi % 12) + 12) % 12;
}

export interface ChromaConfig {
  minFreq: number; // ignore subsonic rumble / DC
  maxFreq: number; // ignore high harmonics that smear the profile
  dbFloor: number; // bins quieter than this contribute nothing
}

export const DEFAULT_CHROMA_CONFIG: ChromaConfig = {
  minFreq: 75,
  maxFreq: 1600,
  dbFloor: -80,
};

export class ChromaExtractor {
  private spectrum: Float32Array<ArrayBuffer>;
  private binPc: Int8Array; // precomputed pitch class per FFT bin (or -1)
  private binHz: number;

  constructor(
    private analyser: AnalyserNode,
    sampleRate: number,
    private cfg: ChromaConfig = DEFAULT_CHROMA_CONFIG,
  ) {
    const bins = analyser.frequencyBinCount;
    this.spectrum = new Float32Array(bins);
    this.binPc = new Int8Array(bins).fill(-1);
    this.binHz = sampleRate / analyser.fftSize;
    for (let i = 1; i < bins; i++) {
      const f = i * this.binHz;
      if (f >= cfg.minFreq && f <= cfg.maxFreq) this.binPc[i] = freqPitchClass(f);
    }
  }

  // Returns a unit-normalized 12-vector chroma for the current frame.
  compute(out: Float32Array): Float32Array {
    out.fill(0);
    this.analyser.getFloatFrequencyData(this.spectrum); // dB
    for (let i = 1; i < this.spectrum.length; i++) {
      const pc = this.binPc[i];
      if (pc < 0) continue;
      const db = this.spectrum[i];
      if (db < this.cfg.dbFloor) continue;
      out[pc] += Math.pow(10, db / 20); // dB -> linear magnitude
    }
    // Whiten: subtract the mean and clamp. Guitar chroma has broadband energy
    // in every bin (room noise, body resonance), which caps cosine similarity
    // to the sparse 3-note templates. Removing that flat floor lets the actual
    // chord tones dominate -> higher, truer confidence + cleaner separation.
    let mean = 0;
    for (let i = 0; i < 12; i++) mean += out[i];
    mean /= 12;
    for (let i = 0; i < 12; i++) out[i] = Math.max(0, out[i] - mean);
    // L2 normalize so loud/quiet strums compare equally (cosine-ready).
    let norm = 0;
    for (let i = 0; i < 12; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let i = 0; i < 12; i++) out[i] /= norm;
    return out;
  }
}
