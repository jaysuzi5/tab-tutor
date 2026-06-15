// Scorer: turns the raw PlayEvent stream into the aggregated SessionSummary
// that the tutor (Groq) reasons over. The summary is the ONLY thing that
// leaves the client for the LLM — never raw events, never audio.

import { SCHEMA_VERSION, type PlayEvent } from "./playEvent";

export interface ChordStat {
  hits: number;
  misses: number;
  avgTimingErrMs: number | null;
}

export interface TransitionMiss {
  from: string;
  to: string;
  count: number;
}

export interface SessionSummary {
  v: number;
  songId: string | null;
  mode: string;
  tempoTarget: number | null;
  tempoAchieved: number | null;
  totalEvents: number;
  perChord: Record<string, ChordStat>;
  recurringMisses: TransitionMiss[];
  cleanRunPct: number; // share of expected hits that were correct
  lowConfidence: boolean; // many uncertain reads -> tutor should ask, not assert
}

const LOW_CONF = 0.6;
// Below this, a detection is treated as "unsure" and excluded from hit/miss
// accounting (so accuracy reflects confident right-vs-wrong plays only).
const SCORE_CONF = 0.5;

export class Scorer {
  private events: PlayEvent[] = [];
  private perChord = new Map<string, ChordStat>();
  private timing = new Map<string, { sum: number; n: number }>();
  private transitions = new Map<string, TransitionMiss>();
  private prevExpected: string | null = null;
  private lowConfCount = 0;

  constructor(
    public songId: string | null = null,
    public mode = "free",
    public tempoTarget: number | null = null,
  ) {}

  ingest(e: PlayEvent) {
    this.events.push(e);
    if (e.confidence < LOW_CONF) this.lowConfCount++;

    // Only score confident reads. An unsure (null) or low-confidence detection
    // means the engine didn't clearly hear a chord — don't punish that as a
    // miss (the humble-fallback contract), or accuracy collapses on transients
    // and quiet frames even when the player is nailing it.
    if (e.expected && e.detected && e.confidence >= SCORE_CONF) {
      const stat = this.perChord.get(e.expected) ?? {
        hits: 0,
        misses: 0,
        avgTimingErrMs: null,
      };
      const correct = e.detected === e.expected;
      if (e.timingErrMs != null) {
        const tm = this.timing.get(e.expected) ?? { sum: 0, n: 0 };
        tm.sum += e.timingErrMs;
        tm.n++;
        this.timing.set(e.expected, tm);
        stat.avgTimingErrMs = Math.round(tm.sum / tm.n);
      }
      if (correct) stat.hits++;
      else {
        stat.misses++;
        if (this.prevExpected && this.prevExpected !== e.expected) {
          const key = `${this.prevExpected}->${e.expected}`;
          const t = this.transitions.get(key) ?? {
            from: this.prevExpected,
            to: e.expected,
            count: 0,
          };
          t.count++;
          this.transitions.set(key, t);
        }
      }
      this.perChord.set(e.expected, stat);
      this.prevExpected = e.expected;
    }
  }

  get count() {
    return this.events.length;
  }

  summary(): SessionSummary {
    let hits = 0,
      total = 0;
    for (const s of this.perChord.values()) {
      hits += s.hits;
      total += s.hits + s.misses;
    }
    return {
      v: SCHEMA_VERSION,
      songId: this.songId,
      mode: this.mode,
      tempoTarget: this.tempoTarget,
      tempoAchieved: null, // step 4
      totalEvents: this.events.length,
      perChord: Object.fromEntries(this.perChord),
      recurringMisses: [...this.transitions.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      cleanRunPct: total ? Math.round((hits / total) * 100) : 0,
      lowConfidence:
        this.events.length > 4 &&
        this.lowConfCount / this.events.length > 0.4,
    };
  }
}
