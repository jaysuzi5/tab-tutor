import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import { usePractice } from "../engine/usePractice";
import { buildTimeline } from "../engine/timeline";
import { BUILTIN_SONGS } from "../songs";
import { listSongs, getSong, type SongMeta, type Song } from "../api";
import { ChartView } from "../ui/ChartView";
import { Transport } from "../ui/Transport";
import { SongPicker } from "../ui/SongPicker";
import { ChordDiagram } from "../ui/ChordDiagram";
import { CHORD_SHAPES } from "../engine/chordShapes";
import { playChord } from "../engine/chordAudio";

const AlphaTabView = lazy(() =>
  import("../ui/AlphaTabView").then((m) => ({ default: m.AlphaTabView })),
);

const FALLBACK = BUILTIN_SONGS[0];

export function SongsPage({ mic, sp }: { mic: MicApi; sp: SpotifyApi }) {
  const { frame, setExpected, setTiming } = mic;

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>(FALLBACK.id);
  const [song, setSong] = useState<Song | null>(null);
  const [tempo, setTempo] = useState(96);
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

  useEffect(() => {
    getSong(selectedId)
      .then((s) => {
        setSong(s);
        if (s.tempo) setTempo(s.tempo);
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
  const activeChord = frame?.live.chord ?? null;

  const [spotifyMode, setSpotifyMode] = useState(false);
  const practice = usePractice({
    chordpro,
    tempo,
    mode: "playthrough",
    drillStart: 0,
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
  const normalStart = () => {
    setSpotifyMode(false);
    practice.play();
  };
  const syncedStart = () => {
    setSpotifyMode(true);
    practice.play({
      muteAfterCountIn: true,
      onMusicStart: () => {
        if (song?.spotifyUri) sp.playUri(song.spotifyUri);
      },
    });
  };

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
    <main className="layout single">
      <section className="left">
        <SongPicker
          songs={songs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onImported={(id) => refreshList(id)}
        />

        {song && (
          <div className="song-info">
            <span className="song-title">{song.title}</span>
            {song.artist && <span className="song-artist"> — {song.artist}</span>}
            <span className="song-meta">
              {song.key && <em>Key {song.key}</em>}
              {song.tempo && <em>{song.tempo} BPM</em>}
              {song.capo != null && song.capo > 0 && <em>Capo {song.capo}</em>}
            </span>
          </div>
        )}

        {!isTab && chords.length > 0 && (
          <div className="song-chords">
            {chords.map((c) => (
              <div key={c} className="chord-card">
                <div className="chord-card-name">{c}</div>
                {CHORD_SHAPES[c] ? (
                  <ChordDiagram chord={c} size={0.7} />
                ) : (
                  <div className="chord-card-unknown muted small">no diagram</div>
                )}
                <button onClick={() => playChord(c)}>▶ Hear it</button>
              </div>
            ))}
          </div>
        )}

        {isTab && song ? (
          <Suspense fallback={<div className="chart muted">Loading tab renderer…</div>}>
            <AlphaTabView songId={song.id} />
          </Suspense>
        ) : (
          <>
            <Transport
              tempo={tempo}
              setTempo={setTempo}
              songTempo={songTempo}
              playing={practice.playing}
              countIn={practice.countIn}
              onPlay={normalStart}
              onStop={practice.stop}
              spotifyStartAvailable={canSpotifyStart}
              onSpotifyStart={syncedStart}
            />
            {practice.done && (
              <p className="done-banner">🎉 Reached the end — nice run! Hit Play to go again.</p>
            )}
            <ChartView
              chordpro={chordpro}
              activeChord={activeChord}
              cursorIndex={cursorIndex}
              cursorState={cursorState}
              scrollOnly={spotifyMode}
              playing={practice.playing}
              done={practice.done}
            />
          </>
        )}
      </section>
    </main>
  );
}

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
