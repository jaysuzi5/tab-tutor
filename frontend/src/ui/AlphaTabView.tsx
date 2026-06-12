// Renders imported Guitar Pro / MusicXML via alphaTab, with its built-in synth
// playback + beat-synced cursor (spec §4: the universal play-along). This is a
// distinct path from chord-detection scoring — full tab scoring is out of MVP.
//
// Font + soundfont load from the alphaTab CDN to avoid bundling worker/font
// assets through Vite. On the homelab this needs outbound HTTPS (the cloudflared
// tunnel provides it); self-host these for a fully offline deploy.

import { useEffect, useRef, useState } from "react";
import * as alphaTab from "@coderline/alphatab";
import { songFileUrl } from "../api";

const CDN = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.3/dist";

export function AlphaTabView({ songId }: { songId: string }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    const api = new alphaTab.AlphaTabApi(mainRef.current, {
      core: { fontDirectory: `${CDN}/font/`, file: songFileUrl(songId) },
      player: {
        enablePlayer: true,
        soundFont: `${CDN}/soundfont/sonivox.sf2`,
        scrollElement: mainRef.current,
        enableCursor: true,
      },
    });
    apiRef.current = api;
    api.playerReady.on(() => setReady(true));
    api.playerStateChanged.on((e) => setPlaying(e.state === 1));
    api.error.on((e) =>
      setError(e?.message ?? "Couldn't read this file — is it a valid Guitar Pro / MusicXML?"),
    );
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [songId]);

  const setPlaybackSpeed = (s: number) => {
    setSpeed(s);
    if (apiRef.current) apiRef.current.playbackSpeed = s;
  };

  return (
    <div className="chart alphatab-wrap">
      <div className="alphatab-controls">
        <button
          onClick={() => apiRef.current?.playPause()}
          disabled={!ready || !!error}
        >
          {error ? "—" : !ready ? "loading…" : playing ? "■ Stop" : "▶ Play"}
        </button>
        {error && <span className="import-err">{error}</span>}
        <label className="muted">
          Speed {Math.round(speed * 100)}%
          <input
            type="range"
            min={0.25}
            max={1.25}
            step={0.05}
            value={speed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          />
        </label>
      </div>
      <div ref={mainRef} className="alphatab-main" />
    </div>
  );
}
