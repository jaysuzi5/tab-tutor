// Step 1: builtin songs bundled as raw ChordPro strings. Later (step 5) these
// come from the backend /api/songs library; the shape stays the same.

export interface BuiltinSong {
  id: string;
  chordpro: string;
}

// Vite raw import keeps the canonical .cho files in /songs as the source.
import riverside from "../../songs/down-by-the-riverside.cho?raw";

export const BUILTIN_SONGS: BuiltinSong[] = [
  { id: "down-by-the-riverside", chordpro: riverside },
];

// Pull the {chords: ...} directive (ordered, de-duped) for the trainer/UI.
export function chordsOf(chordpro: string): string[] {
  const m = chordpro.match(/\{chords:\s*([^}]+)\}/i);
  if (!m) return [];
  return [...new Set(m[1].trim().split(/\s+/).filter(Boolean))];
}
