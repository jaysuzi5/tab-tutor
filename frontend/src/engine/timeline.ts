// Turns a ChordPro sheet into a beat timeline so a cursor can advance at tempo.
// Campfire charts have no per-beat timing, so we use a simple, predictable
// grid: each chord occurrence holds for `beatsPerChord` (one bar by default).
// The cursor lands on the matching .chord token in document order.

export interface Timeline {
  chords: string[]; // ordered chord occurrences (incl. repeats)
  beatsPerChord: number;
}

export function buildTimeline(chordpro: string, beatsPerChord = 4): Timeline {
  // Strip directives so {key: G} etc. don't get read as chords.
  const body = chordpro.replace(/\{[^}]*\}/g, "");
  const chords = [...body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return { chords, beatsPerChord };
}

// Map a music beat to the active chord-occurrence index. `window` (Drill mode)
// restricts + loops over a sub-range [start, end).
export function chordIndexAt(
  tl: Timeline,
  musicBeat: number,
  window?: { start: number; end: number },
): number {
  if (tl.chords.length === 0) return -1;
  const seg = Math.max(0, Math.floor(musicBeat / tl.beatsPerChord));
  if (window) {
    const len = Math.max(1, window.end - window.start);
    return window.start + (seg % len);
  }
  return seg % tl.chords.length;
}
