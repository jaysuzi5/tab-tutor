import { useEffect, useState } from "react";
import { useMic } from "./engine/useMic";
import { PracticePage } from "./pages/PracticePage";
import { SpeedTrainerPage } from "./pages/SpeedTrainerPage";
import { StrummingPage } from "./pages/StrummingPage";

type View = "practice" | "trainer" | "strum";

const viewFromHash = (): View =>
  location.hash === "#/trainer"
    ? "trainer"
    : location.hash === "#/strum"
      ? "strum"
      : "practice";

const HASH: Record<View, string> = {
  practice: "#/",
  trainer: "#/trainer",
  strum: "#/strum",
};

export default function App() {
  // One mic/engine instance for the whole app; pages share it so navigating
  // doesn't restart the mic.
  const mic = useMic();
  const [view, setView] = useState<View>(viewFromHash);

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
          <button
            className={view === "practice" ? "active" : ""}
            onClick={() => go("practice")}
          >
            Practice
          </button>
          <button
            className={view === "trainer" ? "active" : ""}
            onClick={() => go("trainer")}
          >
            Speed Trainer
          </button>
          <button
            className={view === "strum" ? "active" : ""}
            onClick={() => go("strum")}
          >
            Strumming
          </button>
        </nav>
      </header>

      {view === "trainer" ? (
        <SpeedTrainerPage mic={mic} />
      ) : view === "strum" ? (
        <StrummingPage mic={mic} />
      ) : (
        <PracticePage mic={mic} />
      )}
    </div>
  );
}
