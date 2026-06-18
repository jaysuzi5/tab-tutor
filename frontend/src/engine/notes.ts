// Frequency <-> note-name / cents math. Shared by tuner and chord detector.

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// A4 reference; calibration may later adjust this per-room/tuning.
export const A4 = 440;

export interface NoteReading {
  note: string; // e.g. "E"
  octave: number; // e.g. 2
  midi: number;
  cents: number; // signed deviation from equal-tempered pitch, -50..+50
  freq: number;
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / A4);
}

export function midiToFreq(midi: number): number {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

// Convert a measured frequency to nearest note + how many cents off.
export function freqToNote(freq: number): NoteReading {
  const midiFloat = freqToMidi(freq);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note: name, octave, midi, cents, freq };
}

// Pitch class only (0..11), ignoring octave. Feeds chroma/chord detection.
export function freqToPitchClass(freq: number): number {
  return ((Math.round(freqToMidi(freq)) % 12) + 12) % 12;
}

// Parse a note name like "E2", "Eb3", "F#4" -> MIDI number (null if invalid).
export function noteToMidi(s: string): number | null {
  const m = s.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let v = base[m[1].toUpperCase()];
  if (m[2] === "#") v++;
  if (m[2] === "b") v--;
  return (parseInt(m[3], 10) + 1) * 12 + v;
}

// Standard guitar open strings (low to high), for the tuner target hints.
export const GUITAR_STRINGS: { label: string; midi: number; freq: number }[] = [
  { label: "E2", midi: 40, freq: midiToFreq(40) },
  { label: "A2", midi: 45, freq: midiToFreq(45) },
  { label: "D3", midi: 50, freq: midiToFreq(50) },
  { label: "G3", midi: 55, freq: midiToFreq(55) },
  { label: "B3", midi: 59, freq: midiToFreq(59) },
  { label: "E4", midi: 64, freq: midiToFreq(64) },
];

// Nearest open string to a frequency — drives "you're tuning the A string".
export function nearestString(freq: number) {
  const midi = freqToMidi(freq);
  let best = GUITAR_STRINGS[0];
  let bestDist = Infinity;
  for (const s of GUITAR_STRINGS) {
    const d = Math.abs(s.midi - midi);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}
