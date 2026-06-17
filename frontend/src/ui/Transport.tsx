// Mode switcher + tempo slider + transport. Tempo slider is always visible
// (slow-down-to-learn, spec §8). Drill mode picks a chord transition to loop.

import type { Mode } from "../engine/usePractice";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "learn", label: "Learn", hint: "one chord at a time" },
  { id: "playthrough", label: "Play-through", hint: "follow the chart at tempo" },
  { id: "drill", label: "Drill", hint: "loop the hard change" },
];

export function Transport({
  mode,
  setMode,
  tempo,
  setTempo,
  songTempo,
  playing,
  countIn,
  onPlay,
  onStop,
  chords,
  drillStart,
  setDrillStart,
  spotifyStartAvailable = false,
  onSpotifyStart,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  tempo: number;
  setTempo: (t: number) => void;
  songTempo: number;
  playing: boolean;
  countIn: number;
  onPlay: () => void;
  onStop: () => void;
  chords: string[];
  drillStart: number;
  setDrillStart: (i: number) => void;
  spotifyStartAvailable?: boolean;
  onSpotifyStart?: () => void;
}) {
  const pct = Math.round((tempo / songTempo) * 100);
  const clock = mode !== "learn";

  return (
    <div className="transport">
      <div className="mode-switch">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${mode === m.id ? "active" : ""}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>

      {clock && (
        <>
          <div className="tempo">
            <label>
              Tempo <strong>{tempo}</strong> bpm{" "}
              <span className="muted">({pct}% of {songTempo})</span>
            </label>
            <input
              type="range"
              min={Math.round(songTempo * 0.5)}
              max={Math.round(songTempo * 1.2)}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
            />
          </div>

          {mode === "drill" && (
            <div className="drill-pick">
              <span className="muted">Loop:</span>
              <button
                onClick={() => setDrillStart(Math.max(0, drillStart - 1))}
                disabled={drillStart <= 0}
              >
                ‹
              </button>
              <span className="drill-pair">
                {chords[drillStart] ?? "?"} → {chords[drillStart + 1] ?? "?"}
              </span>
              <button
                onClick={() => setDrillStart(Math.min(chords.length - 2, drillStart + 1))}
                disabled={drillStart >= chords.length - 2}
              >
                ›
              </button>
            </div>
          )}

          <div className="transport-controls">
            {playing ? (
              <button className="stop" onClick={onStop}>
                ■ Stop
              </button>
            ) : (
              <>
                <button onClick={() => onPlay()}>▶ Play (metronome)</button>
                {spotifyStartAvailable && (
                  <button className="spotify-start" onClick={() => onSpotifyStart?.()}>
                    ▶ Start with Spotify
                  </button>
                )}
              </>
            )}
            {countIn > 0 && <span className="countin">{countIn}</span>}
          </div>
        </>
      )}
    </div>
  );
}
