// Chord practice: pick the chords you want to drill, the trainer cycles them,
// the tutor coaches, and "Now hearing" shows live detection.

import { useState } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import type { EnableState } from "../App";
import { KNOWN_CHORDS } from "../engine/chords";
import { ChordTrainer } from "../ui/ChordTrainer";
import { LiveChord } from "../ui/LiveChord";
import { TutorPanel } from "../ui/TutorPanel";
import { ChordDiagram } from "../ui/ChordDiagram";
import { EnablePanel } from "../ui/EnablePanel";
import { playChord } from "../engine/chordAudio";
import { useTutor } from "../engine/useTutor";

export function PracticePage({
  mic,
  sp,
  enable,
}: {
  mic: MicApi;
  sp: SpotifyApi;
  enable: EnableState;
}) {
  const { status, frame, summary, setExpected } = mic;
  const running = status === "running";
  const [selected, setSelected] = useState<string[]>(["G", "C", "D", "Em"]);
  const tutor = useTutor("chord-practice", "practice", summary, running);

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <main className="layout">
      <section className="left">
        <div className="trainer-page">
          <h2>Chord practice</h2>
          <p className="muted">
            Pick the chords to drill. The trainer cycles through them — play each
            until it's clean. Tap a chord to hear it and see the fingering.
          </p>

          <div className="chord-select">
            {KNOWN_CHORDS.map((c) => (
              <button
                key={c}
                className={`chip ${selected.includes(c) ? "active" : ""}`}
                onClick={() => toggle(c)}
                onDoubleClick={() => playChord(c)}
                title="Click to add/remove · double-click to hear"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="chord-select-diagrams">
            {selected.map((c) => (
              <div key={c} className="mini-diagram" onClick={() => playChord(c)}>
                <ChordDiagram chord={c} size={0.7} />
                <div className="muted small">{c}</div>
              </div>
            ))}
          </div>

          {running ? (
            selected.length > 0 ? (
              <div className="panel">
                <h3>Chord trainer</h3>
                <ChordTrainer
                  chords={selected}
                  frame={frame}
                  setExpected={setExpected}
                  cleanPct={summary?.cleanRunPct ?? 0}
                />
              </div>
            ) : (
              <p className="muted">Pick at least one chord above.</p>
            )
          ) : (
            <p className="muted">Enable the mic (right) to start practicing.</p>
          )}
        </div>
      </section>

      <aside className="right">
        <EnablePanel mic={mic} sp={sp} {...enable} />

        <div className="panel">
          <h3>Tutor</h3>
          <TutorPanel
            text={tutor.text}
            busy={tutor.busy}
            tokens={tutor.tokens}
            onCoach={tutor.coach}
            onAsk={tutor.ask}
          />
        </div>

        {running && (
          <div className="panel">
            <h3>Now hearing</h3>
            <LiveChord live={frame?.live ?? null} />
          </div>
        )}
      </aside>
    </main>
  );
}
