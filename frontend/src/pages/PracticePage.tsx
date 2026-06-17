import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import { usePractice, type Mode } from "../engine/usePractice";
import { buildTimeline } from "../engine/timeline";
import { BUILTIN_SONGS } from "../songs";
import { listSongs, getSong, type SongMeta, type Song } from "../api";
import { ChartView } from "../ui/ChartView";
import { Tuner } from "../ui/Tuner";
import { Calibration } from "../ui/Calibration";
import { LiveChord } from "../ui/LiveChord";
import { ChordTrainer } from "../ui/ChordTrainer";
import { TutorPanel } from "../ui/TutorPanel";
import { Transport } from "../ui/Transport";
import { SongPicker } from "../ui/SongPicker";
import { SpotifyConnect } from "../ui/SpotifyConnect";
import { ChordDiagram } from "../ui/ChordDiagram";
import { playChord } from "../engine/chordAudio";
import { useTutor } from "../engine/useTutor";

// alphaTab is heavy (~1.2MB); only load it when a tab/score song is opened.
const AlphaTabView = lazy(() =>
  import("../ui/AlphaTabView").then((m) => ({ default: m.AlphaTabView })),
);

const FALLBACK = BUILTIN_SONGS[0];

export function PracticePage({ mic, sp }: { mic: MicApi; sp: SpotifyApi }) {
  const { status, frame, summary, start, setExpected, setTiming, setMode } = mic;

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>(FALLBACK.id);
  const [song, setSong] = useState<Song | null>(null);

  const [mode, setModeState] = useState<Mode>("learn");
  const [tempo, setTempo] = useState(96);
  const [drillStart, setDrillStart] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(-1);
  const [practiceChord, setPracticeChord] = useState<string | null>(null);

  const onChordClick = (c: string) => {
    setPracticeChord(c);
    playChord(c); // hear a reference strum
  };

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

  // Spotify play-along run: autoscroll only (no chord coloring) + pause the
  // track when transport stops.
  const [spotifyMode, setSpotifyMode] = useState(false);
  const practice = usePractice({
    chordpro,
    tempo,
    mode,
    drillStart,
    setExpected,
    setTiming,
    onCursor: setCursorIndex,
    onStop: () => sp.pause(),
  });

  const progression = useMemo(
    () => (chordpro ? buildTimeline(chordpro).chords : []),
    [chordpro],
  );

  const canSpotifyStart = !!song?.spotifyUri && sp.enabled && sp.connected && sp.ready;

  // Plain metronome run: 4-count, then scroll + per-chord coloring.
  const normalStart = () => {
    setSpotifyMode(false);
    practice.play();
  };
  // Spotify run: 4-count (audible clicks), then the track starts AND the scroll
  // begins together; metronome muted after the count, no chord coloring.
  const syncedStart = () => {
    setSpotifyMode(true);
    practice.play({
      muteAfterCountIn: true,
      onMusicStart: () => {
        if (song?.spotifyUri) sp.playUri(song.spotifyUri);
      },
    });
  };

  // Color the current Play-through/Drill chord: orange (play now) -> green
  // (heard correct, latched) -> red (heard a wrong chord, not yet correct).
  const [cursorState, setCursorState] = useState<"pending" | "hit" | "miss" | null>(null);
  const hitRef = useRef(false);
  useEffect(() => {
    hitRef.current = false;
    setCursorState(cursorIndex >= 0 ? "pending" : null);
  }, [cursorIndex]);
  useEffect(() => {
    if (cursorIndex < 0) return;
    const expected = progression[cursorIndex];
    const live = frame?.live.chord ?? null;
    if (live === expected) {
      hitRef.current = true;
      setCursorState("hit");
    } else if (!hitRef.current) {
      setCursorState(live ? "miss" : "pending");
    }
  }, [frame, cursorIndex, progression]);

  return (
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
              onPlay={normalStart}
              onStop={practice.stop}
              chords={progression}
              drillStart={drillStart}
              setDrillStart={setDrillStart}
              spotifyStartAvailable={canSpotifyStart}
              onSpotifyStart={syncedStart}
            />
            {practice.done && (
              <p className="done-banner">🎉 Reached the end — nice run! Hit Play to go again.</p>
            )}
            <ChartView
              chordpro={chordpro}
              chords={chords}
              songKey={song?.key}
              tempo={song?.tempo}
              capo={song?.capo}
              activeChord={mode === "playthrough" || mode === "drill" ? null : activeChord}
              cursorIndex={cursorIndex}
              cursorState={cursorState}
              scrollOnly={spotifyMode}
              playing={practice.playing}
              done={practice.done}
              onChordClick={onChordClick}
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

        {practiceChord && (
          <div className="panel">
            <div className="practice-chord-head">
              <h3>Chord: {practiceChord}</h3>
              <button className="ghost" onClick={() => setPracticeChord(null)}>×</button>
            </div>
            <div className="practice-chord-body">
              <ChordDiagram chord={practiceChord} />
              <div className="practice-chord-actions">
                <button onClick={() => playChord(practiceChord)}>▶ Hear it</button>
                {running && (
                  <p className={`muted small ${frame?.live.chord === practiceChord ? "ok" : ""}`}>
                    {frame?.live.chord === practiceChord
                      ? "✓ that's it!"
                      : "strum it — I'll confirm"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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

        <SpotifyConnect sp={sp} />

        <div className="panel">
          <h3>Tuner</h3>
          <Tuner result={frame?.pitch ?? null} />
        </div>

        <div className="panel">
          <Calibration status={status} result={frame?.pitch ?? null} onStart={start} />
        </div>
      </aside>
    </main>
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
