import { useEffect, useState } from "react";
import { useMic } from "./engine/useMic";
import { PracticePage } from "./pages/PracticePage";
import { SpeedTrainerPage } from "./pages/SpeedTrainerPage";

type View = "practice" | "trainer";

const viewFromHash = (): View =>
  location.hash === "#/trainer" ? "trainer" : "practice";

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
    location.hash = v === "trainer" ? "#/trainer" : "#/";
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
        </nav>
      </header>

      {view === "trainer" ? (
        <SpeedTrainerPage mic={mic} />
      ) : (
        <PracticePage mic={mic} />
      )}
    </div>
  );
}
