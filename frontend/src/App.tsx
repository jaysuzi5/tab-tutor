import { useEffect, useState } from "react";
import { useMic } from "./engine/useMic";
import { useSpotify } from "./engine/useSpotify";
import { SongsPage } from "./pages/SongsPage";
import { ChordsPage } from "./pages/ChordsPage";
import { StrummingPage } from "./pages/StrummingPage";
import { TunerPage } from "./pages/TunerPage";
import { SetupPage } from "./pages/SetupPage";

type View = "songs" | "chords" | "strum" | "tuner" | "setup";

export interface EnableState {
  wantMic: boolean;
  setWantMic: (b: boolean) => void;
  wantSpotify: boolean;
  setWantSpotify: (b: boolean) => void;
}

const HASH: Record<View, string> = {
  songs: "#/",
  chords: "#/chords",
  strum: "#/strum",
  tuner: "#/tuner",
  setup: "#/setup",
};
const NAV: { view: View; label: string }[] = [
  { view: "songs", label: "Songs" },
  { view: "chords", label: "Chords" },
  { view: "strum", label: "Strumming" },
  { view: "tuner", label: "Tuner" },
  { view: "setup", label: "Setup" },
];

const viewFromHash = (): View =>
  (Object.keys(HASH) as View[]).find((v) => HASH[v] === location.hash) ?? "songs";

export default function App() {
  const mic = useMic();
  const sp = useSpotify();
  const [view, setView] = useState<View>(viewFromHash);
  const [wantMic, setWantMic] = useState(true);
  const [wantSpotify, setWantSpotify] = useState(true);
  const enable: EnableState = { wantMic, setWantMic, wantSpotify, setWantSpotify };

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    location.hash = HASH[v];
    setView(v);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎸 Tab Tutor</h1>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.view} className={view === n.view ? "active" : ""} onClick={() => go(n.view)}>
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      {view === "chords" ? (
        <ChordsPage mic={mic} />
      ) : view === "strum" ? (
        <StrummingPage mic={mic} />
      ) : view === "tuner" ? (
        <TunerPage mic={mic} />
      ) : view === "setup" ? (
        <SetupPage mic={mic} sp={sp} enable={enable} />
      ) : (
        <SongsPage mic={mic} sp={sp} />
      )}
    </div>
  );
}
