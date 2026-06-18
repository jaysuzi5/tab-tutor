import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import type { EnableState } from "../App";
import { EnablePanel } from "../ui/EnablePanel";

export function SetupPage({
  mic,
  sp,
  enable,
}: {
  mic: MicApi;
  sp: SpotifyApi;
  enable: EnableState;
}) {
  const running = mic.status === "running";
  const level = mic.frame?.pitch.level ?? 0;
  // Linear gain that tracks dynamics (sqrt saturated to 100% and looked stuck).
  const pct = Math.min(100, Math.round(level * 300));

  return (
    <main className="layout single">
      <section className="setup-col">
        <EnablePanel mic={mic} sp={sp} {...enable} />

        <div className="panel">
          <h3>Microphone level</h3>
          {running ? (
            <>
              <div className="level-meter">
                <div className="level-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="muted small">
                {level > 0.02
                  ? "Got it — play your guitar and watch the level move. 🎸"
                  : "Play a string — the bar should jump."}
              </p>
            </>
          ) : (
            <p className="muted small">Enable the mic above to see the input level.</p>
          )}
        </div>

        <div className="panel">
          <h3>Privacy</h3>
          <p className="muted small">
            Your mic is used only to listen to your guitar, in your browser. Raw
            audio never leaves this device — only the detected chord/timing.
            Headphones recommended when playing along to Spotify.
          </p>
        </div>
      </section>
    </main>
  );
}
