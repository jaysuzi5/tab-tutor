// Metronome + tempo grid. Schedules accurate clicks via Web Audio lookahead,
// and exposes the beat grid in performance.now() ms so the cursor (which chord
// is "now") and timingErrMs (onset vs nearest beat) share one clock.
//
// Tempo changes restart the grid (perfStart re-anchors) — fine for MVP; a
// drifting mid-grid tempo ramp is a later refinement.

export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private perfStart = 0;
  bpm = 96;
  countInBeats = 4;
  running = false;
  muted = false; // skip audible clicks (e.g. when playing along to Spotify)
  onBeat: ((musicBeat: number, isCountIn: boolean) => void) | null = null;

  get beatMs(): number {
    return 60000 / this.bpm;
  }
  private get countInMs(): number {
    return this.countInBeats * this.beatMs;
  }

  start(bpm: number, countInBeats = 4) {
    this.stop();
    this.bpm = bpm;
    this.countInBeats = countInBeats;
    this.ctx = new AudioContext();
    this.perfStart = performance.now();
    this.nextBeat = 0;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
    this.ctx?.close();
    this.ctx = null;
  }

  // perf time of grid beat i (i in 0..countIn-1 = count-in, then music beats).
  private beatPerf(i: number): number {
    return this.perfStart + i * this.beatMs;
  }

  // Lookahead scheduler: queue clicks whose time is within the window. Recomputes
  // ctx time from the live perf<->ctx relation each tick, self-correcting drift.
  private schedule = () => {
    if (!this.running || !this.ctx) return;
    const LOOKAHEAD = 130;
    const now = performance.now();
    while (this.beatPerf(this.nextBeat) < now + LOOKAHEAD) {
      const i = this.nextBeat;
      const isCount = i < this.countInBeats;
      const when = this.ctx.currentTime + Math.max(0, (this.beatPerf(i) - now) / 1000);
      const downbeat = (i - this.countInBeats) % 4 === 0;
      this.click(when, isCount ? 1320 : downbeat ? 1000 : 800, isCount ? 0.5 : 0.3);
      this.nextBeat++;
    }
    this.timer = window.setTimeout(this.schedule, 25);
  };

  private click(when: number, freq: number, gain: number) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  // Current music beat at perf time `now` (<0 while counting in).
  currentMusicBeat(now: number): number {
    return Math.floor((now - this.perfStart - this.countInMs) / this.beatMs);
  }

  isCountingIn(now: number): boolean {
    return now - this.perfStart < this.countInMs;
  }

  countInRemaining(now: number): number {
    return Math.max(0, Math.ceil((this.perfStart + this.countInMs - now) / this.beatMs));
  }

  // Signed ms from a strum onset to the nearest beat (+late / -early), or null
  // during count-in / when stopped.
  timingErrMs(onsetPerf: number): number | null {
    if (!this.running) return null;
    const rel = onsetPerf - this.perfStart - this.countInMs;
    if (rel < -this.beatMs / 2) return null;
    const nearest = Math.round(rel / this.beatMs) * this.beatMs;
    return rel - nearest;
  }

  // --- 8th-note grid (strumming) ---
  get eighthMs(): number {
    return this.beatMs / 2;
  }

  // Current 8th-note slot since music start (negative during count-in). 4/4 =>
  // 8 eighths per bar; slot 0 is the downbeat of the first bar.
  currentEighth(now: number): number {
    return Math.floor((now - this.perfStart - this.countInMs) / this.eighthMs);
  }

  // Nearest 8th-note slot to a strum onset + signed timing error, or null while
  // counting in / stopped.
  nearestEighth(onsetPerf: number): { slot: number; errMs: number } | null {
    if (!this.running) return null;
    const rel = onsetPerf - this.perfStart - this.countInMs;
    if (rel < -this.eighthMs / 2) return null;
    const slot = Math.round(rel / this.eighthMs);
    return { slot, errMs: rel - slot * this.eighthMs };
  }
}
