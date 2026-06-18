import { useEffect, useState } from "react";
import { useMic } from "./engine/useMic";
import { useSpotify } from "./engine/useSpotify";
import { SongsPage } from "./pages/SongsPage";
import { PracticePage } from "./pages/PracticePage";
import { SpeedTrainerPage } from "./pages/SpeedTrainerPage";
import { StrummingPage } from "./pages/StrummingPage";
import { TunerPage } from "./pages/TunerPage";

type View = "songs" | "practice" | "trainer" | "strum" | "tuner";

export interface EnableState {
  wantMic: boolean;
  setWantMic: (b: boolean) => void;
  wantSpotify: boolean;
  setWantSpotify: (b: boolean) => void;
}

const HASH: Record<View, string> = {
  songs: "#/",
  practice: "#/practice",
  trainer: "#/trainer",
  strum: "#/strum",
  tuner: "#/tuner",
};
const NAV: { view: View; label: string }[] = [
  { view: "songs", label: "Songs" },
  { view: "practice", label: "Practice" },
  { view: "tuner", label: "Tuner" },
  { view: "trainer", label: "Speed Trainer" },
  { view: "strum", label: "Strumming" },
];

const viewFromHash = (): View => {
  const h = location.hash;
  return (Object.keys(HASH) as View[]).find((v) => HASH[v] === h) ?? "songs";
};

export default function App() {
  const mic = useMic();
  const sp = useSpotify();
  const [view, setView] = useState<View>(viewFromHash);
  const [wantMic, setWantMic] = useState(true);
  const [wantSpotify, setWantSpotify] = useState(false);
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
            <button
              key={n.view}
              className={view === n.view ? "active" : ""}
              onClick={() => go(n.view)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      {view === "practice" ? (
        <PracticePage mic={mic} sp={sp} enable={enable} />
      ) : view === "tuner" ? (
        <TunerPage mic={mic} sp={sp} enable={enable} />
      ) : view === "trainer" ? (
        <SpeedTrainerPage mic={mic} sp={sp} enable={enable} />
      ) : view === "strum" ? (
        <StrummingPage mic={mic} sp={sp} enable={enable} />
      ) : (
        <SongsPage mic={mic} sp={sp} enable={enable} />
      )}
    </div>
  );
}
