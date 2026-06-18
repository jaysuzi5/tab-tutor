// Shared enable panel (top of every page's right column): checkboxes for Mic
// and Spotify, one button to turn on whatever is checked. Spotify connect is an
// OAuth redirect, so if both are checked we stash a flag and auto-start the mic
// when we return with the token.

import { useEffect } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";

const AUTO_MIC = "tt_automic";

export function EnablePanel({
  mic,
  sp,
  wantMic,
  setWantMic,
  wantSpotify,
  setWantSpotify,
}: {
  mic: MicApi;
  sp: SpotifyApi;
  wantMic: boolean;
  setWantMic: (b: boolean) => void;
  wantSpotify: boolean;
  setWantSpotify: (b: boolean) => void;
}) {
  const micOn = mic.status === "running";
  const spOn = sp.connected;

  // Returned from a Spotify OAuth redirect with the mic requested -> start it.
  useEffect(() => {
    if (sessionStorage.getItem(AUTO_MIC) === "1") {
      sessionStorage.removeItem(AUTO_MIC);
      mic.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = () => {
    if (wantSpotify && sp.enabled && !spOn) {
      if (wantMic && !micOn) sessionStorage.setItem(AUTO_MIC, "1");
      window.location.href = sp.loginHref; // redirect; returns with token
      return;
    }
    if (wantMic && !micOn) mic.start();
  };

  const bothOn = (!wantMic || micOn) && (!wantSpotify || spOn || !sp.enabled);

  return (
    <div className="panel enable-panel">
      <h3>Get set up</h3>
      <label className="enable-row">
        <input
          type="checkbox"
          checked={wantMic}
          onChange={(e) => setWantMic(e.target.checked)}
          disabled={micOn}
        />
        <span>Microphone {micOn && <em className="ok">· on</em>}</span>
      </label>
      {sp.enabled && (
        <label className="enable-row">
          <input
            type="checkbox"
            checked={wantSpotify}
            onChange={(e) => setWantSpotify(e.target.checked)}
            disabled={spOn}
          />
          <span>Spotify {spOn && <em className="ok">· connected</em>}</span>
        </label>
      )}
      <button onClick={enable} disabled={bothOn || (!wantMic && !wantSpotify)}>
        {bothOn ? "Ready" : "Enable"}
      </button>
      {mic.status === "denied" && (
        <p className="muted small">Mic blocked — allow it in your browser settings.</p>
      )}
      {mic.status === "unsupported" && (
        <p className="muted small">Mic needs HTTPS (or localhost).</p>
      )}
    </div>
  );
}
