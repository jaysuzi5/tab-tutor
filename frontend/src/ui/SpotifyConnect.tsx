// Per-user Spotify play-along (spec §6). Each user connects their OWN account
// via OAuth (one shared developer app, per-user tokens). Premium required for
// in-browser playback. Search a track, play it through the Web Playback SDK
// device, control play/pause/seek. Chart auto-sync is not wired (manual).
//
// All track/playback calls use the user's own token client-side; the backend
// only does the OAuth code<->token exchange.

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const API = "https://api.spotify.com/v1";

interface Track {
  uri: string;
  name: string;
  artists: string;
}

export function SpotifyConnect() {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [paused, setPaused] = useState(true);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/spotify/status")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled && d.configured))
      .catch(() => setEnabled(false));

    const p = new URLSearchParams(location.search);
    const t = p.get("spotify_token");
    if (t) {
      setToken(t);
      history.replaceState({}, "", location.pathname);
    } else if (p.get("spotify_error")) {
      setStatus("Spotify connection failed — try again.");
      history.replaceState({}, "", location.pathname);
    }
  }, []);

  // Authenticated Spotify Web API helper using the user's token.
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const r = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (r.status === 401) {
        setStatus("Session expired — reconnect Spotify.");
        setToken(null);
      }
      return r;
    },
    [token],
  );

  // Load the Web Playback SDK + init the player once we hold a token.
  useEffect(() => {
    if (!token) return;
    const init = () => {
      const player = new window.Spotify.Player({
        name: "Tab Tutor",
        getOAuthToken: (cb: (t: string) => void) => cb(token),
        volume: 0.8,
      });
      playerRef.current = player;
      player.addListener("ready", ({ device_id }: any) => {
        setDeviceId(device_id);
        setStatus("Connected — search a song and hit play.");
      });
      player.addListener("not_ready", () => setStatus("Spotify device offline."));
      player.addListener("authentication_error", () => {
        setStatus("Auth expired — reconnect.");
        setToken(null);
      });
      player.addListener("account_error", () =>
        setStatus("Spotify Premium is required for playback."),
      );
      player.addListener("player_state_changed", (s: any) => {
        if (!s) return;
        setPaused(s.paused);
        const t = s.track_window?.current_track;
        if (t)
          setCurrent({
            uri: t.uri,
            name: t.name,
            artists: t.artists.map((a: any) => a.name).join(", "),
          });
      });
      player.connect();
    };
    if (window.Spotify) init();
    else {
      window.onSpotifyWebPlaybackSDKReady = init;
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      document.body.appendChild(s);
    }
    return () => playerRef.current?.disconnect();
  }, [token]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !token) return;
    const r = await api(`/search?type=track&limit=6&q=${encodeURIComponent(query)}`);
    if (!r.ok) return;
    const d = await r.json();
    setResults(
      (d.tracks?.items ?? []).map((t: any) => ({
        uri: t.uri,
        name: t.name,
        artists: t.artists.map((a: any) => a.name).join(", "),
      })),
    );
  };

  const playTrack = async (track: Track) => {
    if (!deviceId) return;
    await api(`/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      body: JSON.stringify({ uris: [track.uri] }),
    });
    setResults([]);
    setQuery("");
  };

  if (!enabled) return null;

  return (
    <div className="panel">
      <h3>Spotify play-along</h3>
      {!token ? (
        <>
          <p className="muted small">
            Connect your own Spotify (Premium) to play along to the real track.
            Use headphones so the mic only hears your guitar.
          </p>
          <a href="/api/spotify/login">
            <button>Connect Spotify</button>
          </a>
          {status && <p className="muted small">{status}</p>}
        </>
      ) : (
        <div className="spotify-player">
          <form className="spotify-search" onSubmit={search}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a song…"
              disabled={!deviceId}
            />
            <button type="submit" disabled={!deviceId || !query.trim()}>
              Search
            </button>
          </form>

          {results.length > 0 && (
            <ul className="spotify-results">
              {results.map((t) => (
                <li key={t.uri}>
                  <button onClick={() => playTrack(t)}>
                    <strong>{t.name}</strong> <span className="muted">{t.artists}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {current && (
            <div className="spotify-now">
              <div className="spotify-track">
                <strong>{current.name}</strong>
                <span className="muted small"> {current.artists}</span>
              </div>
              <button onClick={() => playerRef.current?.togglePlay()}>
                {paused ? "▶ Play" : "⏸ Pause"}
              </button>
            </div>
          )}

          {status && <p className="muted small">{status}</p>}
        </div>
      )}
    </div>
  );
}
