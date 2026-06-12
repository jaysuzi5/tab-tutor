// Sanity check the chord matcher with synthetic chroma (no mic). Node 22 strips
// the TS types. Builds an "ideal" chroma per chord and confirms identification,
// then a couple of confusables to check the major/minor third actually splits.
import { matchChord } from "./src/engine/chords.ts";

const PCS = {
  E: [4, 8, 11], A: [9, 1, 4], D: [2, 6, 9], G: [7, 11, 2], C: [0, 4, 7],
  Em: [4, 7, 11], Am: [9, 0, 4], Dm: [2, 5, 9], Cadd9: [0, 4, 7, 2],
};

function ideal(pcs) {
  const v = new Float32Array(12);
  pcs.forEach((p) => (v[p] = 1));
  let n = Math.sqrt(pcs.length);
  for (let i = 0; i < 12; i++) v[i] /= n;
  return v;
}

let pass = 0, fail = 0;
for (const [name, pcs] of Object.entries(PCS)) {
  const m = matchChord(ideal(pcs));
  const ok = m.chord === name;
  console.log(`${ok ? "PASS" : "FAIL"} ${name.padEnd(6)} -> ${String(m.chord).padEnd(6)} conf=${m.confidence.toFixed(2)} (runnerUp=${m.runnerUp})`);
  ok ? pass++ : fail++;
}

// Major vs minor must not collapse: feed E-major ideal, must beat Em.
const em = matchChord(ideal(PCS.E));
console.log(`\nE-major chroma -> ${em.chord} (must be E, not Em)`);

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
