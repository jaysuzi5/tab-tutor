// Play-through transport: tempo slider + Play (metronome) and (when available)
// Start with Spotify. No mode switch — play-through is the only option.

export function Transport({
  tempo,
  setTempo,
  songTempo,
  playing,
  countIn,
  onPlay,
  onStop,
  spotifyStartAvailable = false,
  onSpotifyStart,
}: {
  tempo: number;
  setTempo: (t: number) => void;
  songTempo: number;
  playing: boolean;
  countIn: number;
  onPlay: () => void;
  onStop: () => void;
  spotifyStartAvailable?: boolean;
  onSpotifyStart?: () => void;
}) {
  const pct = Math.round((tempo / songTempo) * 100);

  return (
    <div className="transport">
      <div className="tempo">
        <label>
          Tempo <strong>{tempo}</strong> bpm <span className="muted">({pct}%)</span>
        </label>
        <input
          type="range"
          min={Math.round(songTempo * 0.5)}
          max={Math.round(songTempo * 1.2)}
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
        />
      </div>
      <div className="transport-controls">
        {playing ? (
          <button className="stop" onClick={onStop}>■ Stop</button>
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
    </div>
  );
}
