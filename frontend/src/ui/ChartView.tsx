// Renders a ChordPro chord sheet (the beginner path). Step 1 = static render;
// the live cursor/highlight gets wired in step 2 from the PlayEvent stream.

import { useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

export function ChartView({
  chordpro,
  chords,
  activeChord = null,
  cursorIndex = -1,
  cursorState = null,
  scrollOnly = false,
}: {
  chordpro: string;
  chords?: string[]; // authoritative chord list from the backend song model
  activeChord?: string | null;
  cursorIndex?: number;
  cursorState?: "pending" | "hit" | "miss" | null; // color of the current chord
  scrollOnly?: boolean; // autoscroll without coloring chords (Spotify play-along)
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { html, meta } = useMemo(() => {
    const song = new ChordSheetJS.ChordProParser().parse(chordpro);
    const html = new ChordSheetJS.HtmlDivFormatter().format(song);
    return {
      html,
      meta: {
        title: song.title,
        artist: song.artist,
        key: song.key,
        tempo: song.metadata.getSingle("tempo"),
        capo: song.metadata.getSingle("capo"),
        chords: song.metadata.getSingle("chords"),
        license: song.metadata.getSingle("license"),
      },
    };
  }, [chordpro]);

  // Live highlight: light up every chord token on the sheet matching what the
  // engine currently hears. The beat-synced cursor (one position) is step 4.
  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    // chordsheetjs emits an empty .chord span above lyric syllables that have
    // no chord. Index only the NON-EMPTY tokens so cursorIndex (from the
    // timeline of real chords) lines up with the actual chords on the sheet —
    // otherwise the cursor lands on blanks and never reaches the song's end.
    const tokens = [...root.querySelectorAll<HTMLElement>(".chord")].filter(
      (el) => (el.textContent?.trim() ?? "") !== "",
    );
    tokens.forEach((el, i) => {
      const onCursor = i === cursorIndex;
      // scrollOnly (Spotify play-along): just autoscroll, no chord coloring —
      // the highlight drifts out of sync with the recording and distracts.
      const hit = !scrollOnly && !!activeChord && el.textContent?.trim() === activeChord;
      el.classList.toggle("chord-active", hit);
      el.classList.toggle("chord-cursor", !scrollOnly && onCursor);
      el.classList.toggle("cur-pending", !scrollOnly && onCursor && cursorState === "pending");
      el.classList.toggle("cur-hit", !scrollOnly && onCursor && cursorState === "hit");
      el.classList.toggle("cur-miss", !scrollOnly && onCursor && cursorState === "miss");
    });
    if (cursorIndex >= 0 && tokens[cursorIndex]) {
      tokens[cursorIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeChord, cursorIndex, cursorState, scrollOnly, html]);

  return (
    <div className="chart">
      <header className="chart-head">
        <h2>{meta.title}</h2>
        <p className="muted">
          {meta.artist} · key {meta.key} · {meta.tempo} bpm
          {meta.capo && meta.capo !== "0" ? ` · capo ${meta.capo}` : ""}
        </p>
        <p className="chips">
          {(chords ?? (meta.chords ?? "").split(/\s+/)).filter(Boolean).map((c) => (
            <span
              key={c}
              className={`chip ${activeChord === c ? "active" : ""}`}
            >
              {c}
            </span>
          ))}
        </p>
        {meta.license && <p className="license">{meta.license}</p>}
      </header>
      <div
        ref={sheetRef}
        className="chordsheet"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
