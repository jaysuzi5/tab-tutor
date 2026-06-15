// Open-chord template matching. Beginner core (spec §1): E A D G C Em Am Dm,
// plus the common beginner-friendly Cadd9/G-variants. Full polyphonic
// transcription is explicitly NOT a goal — this is tractable chroma matching.

// Pitch classes: C=0 C#=1 D=2 D#=3 E=4 F=5 F#=6 G=7 G#=8 A=9 A#=10 B=11

interface ChordDef {
  name: string;
  pcs: number[]; // chord tones (octave-folded pitch classes)
}

// Weight: root + fifth carry most chroma energy on a strummed open chord;
// the third is what distinguishes major/minor, so weight it enough to catch.
const ROOT_W = 1.0;
const THIRD_W = 0.9;
const FIFTH_W = 0.8;

const CHORDS: ChordDef[] = [
  { name: "E", pcs: [4, 8, 11] }, // E G# B
  { name: "A", pcs: [9, 1, 4] }, // A C# E
  { name: "D", pcs: [2, 6, 9] }, // D F# A
  { name: "G", pcs: [7, 11, 2] }, // G B D
  { name: "C", pcs: [0, 4, 7] }, // C E G
  { name: "Em", pcs: [4, 7, 11] }, // E G B
  { name: "Am", pcs: [9, 0, 4] }, // A C E
  { name: "Dm", pcs: [2, 5, 9] }, // D F A
  { name: "Cadd9", pcs: [0, 4, 7, 2] }, // C E G D (beginner C substitute)
];

// Build L2-normalized template vectors once.
const TEMPLATES: { name: string; vec: Float32Array }[] = CHORDS.map((c) => {
  const v = new Float32Array(12);
  c.pcs.forEach((pc, idx) => {
    const w = idx === 0 ? ROOT_W : idx === 1 ? THIRD_W : FIFTH_W;
    v[pc] = Math.max(v[pc], w);
  });
  let n = 0;
  for (let i = 0; i < 12; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < 12; i++) v[i] /= n;
  return { name: c.name, vec: v };
});

export interface ChordMatch {
  chord: string | null;
  confidence: number; // 0..1, blends similarity + margin over runner-up
  runnerUp: string | null;
  best: number; // raw cosine similarity of winner
}

// Detection gates — tunable (mics/rooms vary; spec §3). 85% target w/ humble
// fallback: below confMin we report null so the tutor asks, not asserts.
export interface MatchConfig {
  simMin: number; // reject weak winners (likely noise / muted strum)
  confMin: number; // below this -> chord:null (low confidence)
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  simMin: 0.5,
  confMin: 0.45,
};

export function matchChord(
  chroma: Float32Array,
  cfg: MatchConfig = DEFAULT_MATCH_CONFIG,
): ChordMatch {
  let best = -1,
    second = -1,
    bestName: string | null = null,
    secondName: string | null = null;
  for (const t of TEMPLATES) {
    let dot = 0;
    for (let i = 0; i < 12; i++) dot += chroma[i] * t.vec[i];
    if (dot > best) {
      second = best;
      secondName = bestName;
      best = dot;
      bestName = t.name;
    } else if (dot > second) {
      second = dot;
      secondName = t.name;
    }
  }
  if (best < cfg.simMin) {
    return { chord: null, confidence: best <= 0 ? 0 : best, runnerUp: null, best };
  }
  // Confidence = similarity scaled by separation from the runner-up. A clear
  // winner (big margin) is trusted; a near-tie is downgraded -> tutor asks.
  const margin = best - Math.max(second, 0);
  // Trust the cosine similarity, with a mild tie penalty. The old curve
  // (0.5 + margin*2.5) rejected good real-world matches (cosine ~0.7, small
  // margin landed ~0.52 < confMin) — chroma from a real strum is never as clean
  // as an ideal template, so it stayed null almost always.
  const confidence = Math.min(1, best * (0.75 + Math.min(0.25, margin * 3)));
  return {
    chord: confidence >= cfg.confMin ? bestName : null,
    confidence,
    runnerUp: secondName,
    best,
  };
}

export const KNOWN_CHORDS = CHORDS.map((c) => c.name);
