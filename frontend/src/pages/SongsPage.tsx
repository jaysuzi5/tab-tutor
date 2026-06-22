import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MicApi } from "../engine/useMic";
import type { SpotifyApi } from "../engine/useSpotify";
import { usePractice } from "../engine/usePractice";
import { buildTimeline } from "../engine/timeline";
import { listSongs, getSong, type SongMeta, type Song } from "../api";
import { ChartView } from "../ui/ChartView";
import { Transport } from "../ui/Transport";
import { SongPicker } from "../ui/SongPicker";
import { SongList } from "../ui/SongList";
import { ChordDiagram } from "../ui/ChordDiagram";
import { CHORD_SHAPES } from "../engine/chordShapes";
import { playChord } from "../engine/chordAudio";
import { StrumNotation } from "../ui/StrumNotation";
import { playStrum } from "../engine/strumAudio";

const AlphaTabView = lazy(() =>
  import("../ui/AlphaTabView").then((m) => ({ default: m.AlphaTabView })),
);

export function SongsPage({ mic, sp }: { mic: MicApi; sp: SpotifyApi }) {
  const { frame, setExpected, setTiming } = mic;

  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [song, setSong] = useState<Song | null>(null);
  const [tempo, setTempo] = useState(96);
  const [cursorIndex, setCursorIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [offsetBeats, setOffsetBeats] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  const refreshList = (selectId?: string) =>
    listSongs()
      .then((list) => {
        setSongs(list);
        if (selectId) setSelectedId(selectId);
        else setSelectedId((cur) => (list.find((s) => s.id === cur) ? cur : list[0]?.id ?? ""));
      })
      .catch(() => setSongs([]));

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSong(null);
      return;
    }
    getSong(selectedId)
      .then((s) => {
        setSong(s);
        if (s.tempo) setTempo(s.tempo);
      })
      .catch(() => setSong(null));
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
    offsetBeats,
    setExpected,
    setTiming,
    onCursor: setCursorIndex,
    onProgress: setProgress,
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
    <main className="songs-page">
      <SongList songs={songs} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="song-main">
        <SongPicker
          songs={songs}
          selectedId={selectedId}
          onImported={(id) => refreshList(id)}
          onPanelOpen={setPanelOpen}
        />

        {!panelOpen && !song && songs.length > 0 && (
          <p className="muted">Pick a song from the list.</p>
        )}
        {!panelOpen && songs.length === 0 && (
          <p className="muted">No songs yet — click “+ Add Song”.</p>
        )}

        {!panelOpen && song && (
          <>
            <div className="song-info">
              <span className="song-title">{song.title}</span>
              {song.artist && <span className="song-artist"> — {song.artist}</span>}
              <span className="song-meta">
                {song.key && <em>Key {song.key}</em>}
                {song.tempo && <em>{song.tempo} BPM</em>}
                {song.capo != null && song.capo > 0 && <em>Capo {song.capo}</em>}
              </span>
            </div>

            {!isTab && (chords.length > 0 || (song.strumming && song.strumming.length > 0)) && (
              <div className="detail-cols">
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
                {song.strumming && song.strumming.length > 0 && (
                  <div className="song-strums">
                    <h4>Strumming pattern</h4>
                    {song.strumming.map((s, i) => (
                      <StrumNotation
                        key={i}
                        pattern={s}
                        songBpm={song.tempo ?? 80}
                        onPlay={() => playStrum(s, song.tempo ?? 80)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {isTab ? (
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
                <div className="sync-offset">
                  <span className="muted small">Scroll sync</span>
                  <button onClick={() => setOffsetBeats((o) => o - 1)} title="scroll earlier">−</button>
                  <span className="muted small">{offsetBeats > 0 ? `+${offsetBeats}` : offsetBeats} beats</span>
                  <button onClick={() => setOffsetBeats((o) => o + 1)} title="scroll later">+</button>
                </div>
                <ChartView
                  chordpro={chordpro}
                  activeChord={activeChord}
                  cursorIndex={cursorIndex}
                  cursorState={cursorState}
                  scrollOnly={spotifyMode}
                  playing={practice.playing}
                  progress={progress}
                />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
