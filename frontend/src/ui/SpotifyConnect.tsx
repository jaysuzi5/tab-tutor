// Optional Spotify Premium play-along (spec §6). Only renders when the backend
// has it enabled + configured. OAuth runs server-side; the callback redirects
// back with ?spotify_token, which we hand to the Web Playback SDK here.
// Chart position-sync (tap-tempo / markers) is a documented later step.

import { useEffect, useState } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

export function SpotifyConnect() {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/spotify/status")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled && d.configured))
      .catch(() => setEnabled(false));

    const p = new URLSearchParams(location.search);
    const t = p.get("spotify_token");
    if (t) {
      setToken(t);
      // Clean the token out of the visible URL.
      history.replaceState({}, "", location.pathname);
    }
  }, []);

  // Load the Web Playback SDK + init a player once we hold a token.
  useEffect(() => {
    if (!token) return;
    const init = () => {
      const player = new window.Spotify.Player({
        name: "Tab Tutor",
        getOAuthToken: (cb: (t: string) => void) => cb(token),
        volume: 0.7,
      });
      player.addListener("ready", () => setStatus("Spotify ready — play a track from the Spotify app and it streams here."));
      player.addListener("not_ready", () => setStatus("Spotify device went offline."));
      player.addListener("initialization_error", ({ message }: any) => setStatus("Init error: " + message));
      player.addListener("authentication_error", () => setStatus("Auth expired — reconnect."));
      player.addListener("account_error", () => setStatus("Spotify Premium is required for playback."));
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
  }, [token]);

  if (!enabled) return null;
  return (
    <div className="panel">
      <h3>Spotify play-along</h3>
      {token ? (
        <p className="muted small">{status || "Connecting…"}</p>
      ) : (
        <>
          <p className="muted small">
            Premium only. Play along to the real recording.
          </p>
          <a href="/api/spotify/login">
            <button>Connect Spotify</button>
          </a>
        </>
      )}
    </div>
  );
}
