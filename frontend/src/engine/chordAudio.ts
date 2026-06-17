// Play a reference strum of a chord using its open-chord fingering. String
// pitches come from standard tuning + the fret per string; we stagger the
// onsets slightly so it sounds strummed, not blocked.

import { CHORD_SHAPES } from "./chordShapes";

// Standard tuning open-string MIDI (low E -> high E).
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let ctx: AudioContext | null = null;

export function playChord(name: string) {
  const shape = CHORD_SHAPES[name];
  if (!shape) return;
  ctx = ctx ?? new AudioContext();
  void ctx.resume();
  const now = ctx.currentTime;
  shape.frets.forEach((fret, i) => {
    if (fret < 0) return; // muted string
    const freq = midiToFreq(OPEN_MIDI[i] + fret);
    const t = now + i * 0.035; // strum spread, low -> high
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(g).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}
