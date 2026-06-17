// Spotify panel (presentational). Connect + search + play/pause. Driven by the
// shared useSpotify hook so Play-through can also start playback.

import { useState } from "react";
import type { SpotifyApi, Track } from "../engine/useSpotify";

export function SpotifyConnect({ sp }: { sp: SpotifyApi }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);

  if (!sp.enabled) return null;

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setResults(await sp.searchTracks(query));
  };

  return (
    <div className="panel">
      <h3>Spotify play-along</h3>
      {!sp.connected ? (
        <>
          <p className="muted small">
            Connect your own Spotify (Premium) to play along to the real track.
            Use headphones so the mic only hears your guitar.
          </p>
          <a href={sp.loginHref}>
            <button>Connect Spotify</button>
          </a>
        </>
      ) : (
        <div className="spotify-player">
          <form className="spotify-search" onSubmit={search}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a song…"
              disabled={!sp.ready}
            />
            <button type="submit" disabled={!sp.ready || !query.trim()}>Search</button>
          </form>

          {results.length > 0 && (
            <ul className="spotify-results">
              {results.map((t) => (
                <li key={t.uri}>
                  <button onClick={() => { sp.playUri(t.uri); setResults([]); setQuery(""); }}>
                    <strong>{t.name}</strong> <span className="muted">{t.artists}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {sp.current && (
            <div className="spotify-now">
              <div className="spotify-track">
                <strong>{sp.current.name}</strong>
                <span className="muted small"> {sp.current.artists}</span>
              </div>
              <button onClick={sp.togglePlay}>{sp.paused ? "▶ Play" : "⏸ Pause"}</button>
            </div>
          )}
        </div>
      )}
      {sp.status && <p className="muted small">{sp.status}</p>}
    </div>
  );
}
