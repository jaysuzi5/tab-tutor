// Tests the tempo-grid math (clock) and chord timeline mapping without audio.
import { Metronome } from "./src/engine/clock.ts";
import { buildTimeline, chordIndexAt } from "./src/engine/timeline.ts";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}`); };

// --- Metronome grid: 120bpm => 500ms/beat, 4-beat count-in => music starts @2000ms
const m = new Metronome();
m.bpm = 120; m.countInBeats = 4; m.running = true; m.perfStart = 0;

ok("music beat 0 at t=2000", m.currentMusicBeat(2000) === 0);
ok("music beat 1 at t=2500", m.currentMusicBeat(2500) === 1);
ok("counting-in at t=1000", m.isCountingIn(1000) === true);
ok("not counting-in at t=2000", m.isCountingIn(2000) === false);
ok("on-beat err = 0", m.timingErrMs(2000) === 0);
ok("late strum +50ms", m.timingErrMs(2050) === 50);
ok("early strum -50ms", m.timingErrMs(2450) === -50);
ok("during count-in -> null", m.timingErrMs(1000) === null);

// --- Timeline / cursor
const cho = "{key: G}\n[G]Lay [C]down [G]by the [D]river[G]side";
const tl = buildTimeline(cho); // beatsPerChord default 4
ok("progression order", tl.chords.join(",") === "G,C,G,D,G");
ok("cursor beat 0 -> idx 0", chordIndexAt(tl, 0) === 0);
ok("cursor beat 4 -> idx 1", chordIndexAt(tl, 4) === 1);
ok("cursor wraps", chordIndexAt(tl, 20) === 0); // 5 chords * 4 beats = 20 -> wrap
ok("drill window loops [1,3)", chordIndexAt(tl, 8, { start: 1, end: 3 }) === 1);
ok("directives not read as chords", !tl.chords.includes("key: G"));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
