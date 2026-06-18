// Setup enable panel: check/uncheck Mic and Spotify, hit Update to apply.
// Unchecking a running source turns it off. Status dots show current state.

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

  useEffect(() => {
    if (sessionStorage.getItem(AUTO_MIC) === "1") {
      sessionStorage.removeItem(AUTO_MIC);
      mic.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = () => {
    // Microphone
    if (wantMic && !micOn) mic.start();
    else if (!wantMic && micOn) mic.stop();
    // Spotify
    if (sp.enabled) {
      if (wantSpotify && !spOn) {
        if (wantMic) sessionStorage.setItem(AUTO_MIC, "1"); // restore mic after redirect
        window.location.href = sp.loginHref;
        return;
      }
      if (!wantSpotify && spOn) sp.disconnect();
    }
  };

  return (
    <div className="panel enable-panel">
      <h3>Get set up</h3>
      <label className="enable-row">
        <input type="checkbox" checked={wantMic} onChange={(e) => setWantMic(e.target.checked)} />
        <span>
          Microphone <Dot on={micOn} /> {micOn ? "on" : "off"}
        </span>
      </label>
      {sp.enabled && (
        <label className="enable-row">
          <input type="checkbox" checked={wantSpotify} onChange={(e) => setWantSpotify(e.target.checked)} />
          <span>
            Spotify <Dot on={spOn} /> {spOn ? "connected" : "not connected"}
          </span>
        </label>
      )}
      <button onClick={update}>Update</button>
      {mic.status === "denied" && (
        <p className="muted small">Mic blocked — allow it in your browser settings.</p>
      )}
      {mic.status === "unsupported" && (
        <p className="muted small">Mic needs HTTPS (or localhost).</p>
      )}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`status-dot ${on ? "on" : "off"}`} aria-hidden />;
}
