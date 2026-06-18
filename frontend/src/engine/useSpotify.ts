// Per-user Spotify hook: owns OAuth token + the Web Playback SDK player, and
// exposes imperative controls (search / playUri / togglePlay) so any page can
// drive playback — e.g. Play-through starts the track + autoscroll together.

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const API = "https://api.spotify.com/v1";

export interface Track {
  uri: string;
  name: string;
  artists: string;
}

export function useSpotify() {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [paused, setPaused] = useState(true);
  const [status, setStatus] = useState("");
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
      history.replaceState({}, "", location.pathname + location.hash);
    } else if (p.get("spotify_error")) {
      setStatus("Spotify connection failed — try again.");
      history.replaceState({}, "", location.pathname + location.hash);
    }
  }, []);

  const apiFetch = useCallback(
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

  const searchTracks = useCallback(
    async (q: string): Promise<Track[]> => {
      if (!q.trim() || !token) return [];
      const r = await apiFetch(`/search?type=track&limit=6&q=${encodeURIComponent(q)}`);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.tracks?.items ?? []).map((t: any) => ({
        uri: t.uri,
        name: t.name,
        artists: t.artists.map((a: any) => a.name).join(", "),
      }));
    },
    [token, apiFetch],
  );

  const playUri = useCallback(
    async (uri: string) => {
      if (!deviceId) return false;
      const r = await apiFetch(`/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [uri] }),
      });
      return r.ok;
    },
    [deviceId, apiFetch],
  );

  const pause = useCallback(() => playerRef.current?.pause(), []);
  const togglePlay = useCallback(() => playerRef.current?.togglePlay(), []);
  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    setToken(null);
    setDeviceId(null);
    setCurrent(null);
    setStatus("");
  }, []);

  return {
    enabled,
    connected: !!token,
    ready: !!deviceId,
    current,
    paused,
    status,
    loginHref: "/api/spotify/login",
    searchTracks,
    playUri,
    pause,
    togglePlay,
    disconnect,
  };
}

export type SpotifyApi = ReturnType<typeof useSpotify>;
