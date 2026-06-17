// Renders a ChordPro chord sheet with a beat-synced cursor + per-chord color
// feedback. Header metadata + chord chips come from the backend song model.

import { useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

export function ChartView({
  chordpro,
  chords,
  songKey = null,
  tempo = null,
  capo = null,
  activeChord = null,
  cursorIndex = -1,
  cursorState = null,
  scrollOnly = false,
  playing = false,
  done = false,
  onChordClick,
}: {
  chordpro: string;
  chords?: string[]; // authoritative chord list from the backend song model
  songKey?: string | null;
  tempo?: number | null;
  capo?: number | null;
  activeChord?: string | null;
  cursorIndex?: number;
  cursorState?: "pending" | "hit" | "miss" | null;
  scrollOnly?: boolean; // autoscroll without coloring chords (Spotify play-along)
  playing?: boolean;
  done?: boolean;
  onChordClick?: (chord: string) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const { html, meta } = useMemo(() => {
    const song = new ChordSheetJS.ChordProParser().parse(chordpro);
    const html = new ChordSheetJS.HtmlDivFormatter().format(song);
    return {
      html,
      meta: { title: song.title, artist: song.artist, chords: song.metadata.getSingle("chords") },
    };
  }, [chordpro]);

  // Manual scroll cancels auto-scroll so we don't yank the user around. Reset
  // when a new run starts.
  useEffect(() => {
    if (playing) userScrolledRef.current = false;
  }, [playing]);
  useEffect(() => {
    const onUser = () => {
      if (playing) userScrolledRef.current = true;
    };
    window.addEventListener("wheel", onUser, { passive: true });
    window.addEventListener("touchmove", onUser, { passive: true });
    return () => {
      window.removeEventListener("wheel", onUser);
      window.removeEventListener("touchmove", onUser);
    };
  }, [playing]);

  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    // chordsheetjs emits empty .chord spans above lyric syllables with no chord;
    // index only non-empty tokens so cursorIndex lines up with real chords.
    const tokens = [...root.querySelectorAll<HTMLElement>(".chord")].filter(
      (el) => (el.textContent?.trim() ?? "") !== "",
    );
    tokens.forEach((el, i) => {
      const onCursor = i === cursorIndex;
      const hit = !scrollOnly && !!activeChord && el.textContent?.trim() === activeChord;
      el.classList.toggle("chord-active", hit);
      el.classList.toggle("chord-cursor", !scrollOnly && onCursor);
      el.classList.toggle("cur-pending", !scrollOnly && onCursor && cursorState === "pending");
      el.classList.toggle("cur-hit", !scrollOnly && onCursor && cursorState === "hit");
      el.classList.toggle("cur-miss", !scrollOnly && onCursor && cursorState === "miss");
    });
    if (cursorIndex >= 0 && tokens[cursorIndex] && !userScrolledRef.current) {
      tokens[cursorIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeChord, cursorIndex, cursorState, scrollOnly, html]);

  // Reaching the end: scroll the last lines fully into view.
  useEffect(() => {
    if (done && sheetRef.current && !userScrolledRef.current) {
      const last = sheetRef.current.lastElementChild;
      last?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [done]);

  return (
    <div className="chart">
      <header className="chart-head">
        <h2>{meta.title}</h2>
        <p className="muted">
          {meta.artist}
          {songKey ? ` · key ${songKey}` : ""}
          {tempo ? ` · ${tempo} bpm` : ""}
          {capo ? ` · capo ${capo}` : ""}
        </p>
        <p className="chips">
          {(chords ?? (meta.chords ?? "").split(/\s+/)).filter(Boolean).map((c) => (
            <button
              key={c}
              className={`chip ${activeChord === c ? "active" : ""}`}
              onClick={() => onChordClick?.(c)}
              title={`Practice ${c} — hear it + see the fingering`}
            >
              {c}
            </button>
          ))}
        </p>
      </header>
      <div ref={sheetRef} className="chordsheet" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
