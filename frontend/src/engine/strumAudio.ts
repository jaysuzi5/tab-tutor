// Play a strumming pattern: a click on each non-rest slot at the pattern's
// tempo (down lower-pitched, up higher). Loops the bar twice.

import type { StrumPattern } from "../api";

let ctx: AudioContext | null = null;

export function playStrum(p: StrumPattern, songBpm = 80) {
  const bpm = p.bpm || songBpm;
  if (!bpm || !p.slots.length) return;
  ctx = ctx ?? new AudioContext();
  void ctx.resume();
  const per = p.subdivision === "triplet" ? 3 : p.subdivision === "sixteenth" ? 4 : 2; // slots/beat
  const slotDur = 60 / bpm / per;
  const now = ctx.currentTime + 0.06;
  const bars = p.slots.length > 4 * per ? 1 : 2; // multi-bar once, single bar twice
  for (let b = 0; b < bars; b++) {
    p.slots.forEach((s, i) => {
      if (!s) return;
      const t = now + (b * p.slots.length + i) * slotDur;
      click(t, s === "D" ? 660 : 1180);
    });
  }
}

function click(when: number, freq: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.25, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
  osc.connect(g).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.14);
}
