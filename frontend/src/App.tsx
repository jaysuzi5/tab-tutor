import { lazy, Suspense, useEffect, useState } from "react";
import { useMic } from "./engine/useMic";
import { usePractice, type Mode } from "./engine/usePractice";
import { buildTimeline } from "./engine/timeline";
import { BUILTIN_SONGS } from "./songs";
import {
  listSongs,
  getSong,
  type SongMeta,
  type Song,
} from "./api";
import { ChartView } from "./ui/ChartView";
import { Tuner } from "./ui/Tuner";
import { Calibration } from "./ui/Calibration";
import { LiveChord } from "./ui/LiveChord";
import { ChordTrainer } from "./ui/ChordTrainer";
import { TutorPanel } from "./ui/TutorPanel";
import { Transport } from "./ui/Transport";
import { SongPicker } from "./ui/SongPicker";
import { SpotifyConnect } from "./ui/SpotifyConnect";
import { useTutor } from "./engine/useTutor";

// alphaTab is heavy (~1.2MB); only load it when a tab/score song is opened.
const AlphaTabView = lazy(() =>
  import("./ui/AlphaTabView").then((m) => ({ default: m.AlphaTabView })),
);

// Local fallback so the chart still renders if the backend is down.
const FALLBACK = BUILTIN_SONGS[0];

export default function App() {
  const { status, frame, summary, start, setExpected, setTiming, setMode } = useMic();

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>(FALLBACK.id);
  const [song, setSong] = useState<Song | null>(null);

  const [mode, setModeState] = useState<Mode>("learn");
  const [tempo, setTempo] = useState(96);
  const [drillStart, setDrillStart] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(-1);

  const refreshList = (selectId?: string) =>
    listSongs()
      .then((list) => {
        setSongs(list);
        if (selectId) setSelectedId(selectId);
        else if (!list.find((s) => s.id === selectedId) && list[0])
          setSelectedId(list[0].id);
      })
      .catch(() => setSongs([{ ...metaOf(FALLBACK.chordpro), id: FALLBACK.id }]));

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the full selected song (chart + metadata).
  useEffect(() => {
    getSong(selectedId)
      .then((s) => {
        setSong(s);
        if (s.tempo) setTempo(s.tempo);
        setDrillStart(0);
      })
      .catch(() => {
        if (selectedId === FALLBACK.id)
          setSong({ ...metaOf(FALLBACK.chordpro), id: FALLBACK.id, chordpro: FALLBACK.chordpro });
      });
  }, [selectedId]);

  const isTab = song?.format === "gp" || song?.format === "musicxml";
  const chordpro = isTab ? "" : song?.chordpro ?? "";
  const chords = song?.chords ?? [];
  const songTempo = song?.tempo ?? 96;
  const running = status === "running";
  const activeChord = frame?.live.chord ?? null;
  const tutor = useTutor(selectedId, mode, summary, running);

  useEffect(() => {
    setMode(mode, mode === "learn" ? null : tempo);
  }, [mode, tempo, setMode]);

  const practice = usePractice({
    chordpro,
    tempo,
    mode,
    drillStart,
    setExpected,
    setTiming,
    onCursor: setCursorIndex,
  });

  const progression = chordpro ? buildTimeline(chordpro).chords : [];

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎸 Tab Tutor</h1>
        <span className="muted">It hears every wrong note. Then it fixes you.</span>
      </header>

      <main className="layout">
        <section className="left">
          <SongPicker
            songs={songs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onImported={(id) => refreshList(id)}
          />

          {isTab && song ? (
            <Suspense fallback={<div className="chart muted">Loading tab renderer…</div>}>
              <AlphaTabView songId={song.id} />
            </Suspense>
          ) : (
            <>
              <Transport
                mode={mode}
                setMode={setModeState}
                tempo={tempo}
                setTempo={setTempo}
                songTempo={songTempo}
                playing={practice.playing}
                countIn={practice.countIn}
                onPlay={practice.play}
                onStop={practice.stop}
                chords={progression}
                drillStart={drillStart}
                setDrillStart={setDrillStart}
              />
              <ChartView
                chordpro={chordpro}
                chords={chords}
                activeChord={activeChord}
                cursorIndex={cursorIndex}
              />
            </>
          )}
        </section>

        <aside className="right">
          <div className="panel">
            <h3>Tutor</h3>
            <TutorPanel
              text={tutor.text}
              busy={tutor.busy}
              tokens={tutor.tokens}
              onCoach={tutor.coach}
              onAsk={tutor.ask}
            />
          </div>

          {running && (
            <div className="panel">
              <h3>Now hearing</h3>
              <LiveChord live={frame?.live ?? null} />
            </div>
          )}

          {running && mode === "learn" && chords.length > 0 && (
            <div className="panel">
              <h3>Chord trainer</h3>
              <ChordTrainer
                chords={chords}
                frame={frame}
                setExpected={setExpected}
                cleanPct={summary?.cleanRunPct ?? 0}
              />
            </div>
          )}

          <SpotifyConnect />

          <div className="panel">
            <h3>Tuner</h3>
            <Tuner result={frame?.pitch ?? null} />
          </div>

          <div className="panel">
            <Calibration status={status} result={frame?.pitch ?? null} onStart={start} />
          </div>
        </aside>
      </main>
    </div>
  );
}

// Minimal local meta for the offline fallback song.
function metaOf(chordpro: string): SongMeta {
  const m = (k: string) => chordpro.match(new RegExp(`\\{${k}:\\s*([^}]+)\\}`, "i"))?.[1]?.trim();
  return {
    id: "",
    title: m("title") ?? "Song",
    artist: m("artist"),
    tempo: m("tempo") ? Number(m("tempo")) : 96,
    chords: (m("chords") ?? "").split(/\s+/).filter(Boolean),
    format: "chordpro",
    isBuiltin: true,
  };
}
