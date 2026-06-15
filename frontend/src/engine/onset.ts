// Strum onset detection via RMS envelope rising-edge with a refractory window.
// Each onset is when we sample "what chord did they just play" and emit a
// PlayEvent. Good enough for strummed open chords (not lead/fast picking).

export interface OnsetConfig {
  gate: number; // min RMS to count as sound at all
  riseRatio: number; // cur must exceed prev*ratio to be an attack
  refractoryMs: number; // ignore re-triggers within this window
}

export const DEFAULT_ONSET_CONFIG: OnsetConfig = {
  gate: 0.01,
  // 1.8x rise missed strums into already-ringing strings (fast changes). 1.4x
  // catches normal strums while still ignoring steady sustain.
  riseRatio: 1.4,
  refractoryMs: 120,
};

export class OnsetDetector {
  private prev = 0;
  private lastOnsetMs = -Infinity;
  constructor(private cfg: OnsetConfig = DEFAULT_ONSET_CONFIG) {}

  setConfig(cfg: Partial<OnsetConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  // Returns true on the frame an attack begins.
  detect(rms: number, nowMs: number): boolean {
    const isAttack =
      rms > this.cfg.gate &&
      rms > this.prev * this.cfg.riseRatio &&
      nowMs - this.lastOnsetMs > this.cfg.refractoryMs;
    this.prev = rms;
    if (isAttack) {
      this.lastOnsetMs = nowMs;
      return true;
    }
    return false;
  }
}
