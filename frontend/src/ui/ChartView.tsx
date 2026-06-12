// Renders a ChordPro chord sheet (the beginner path). Step 1 = static render;
// the live cursor/highlight gets wired in step 2 from the PlayEvent stream.

import { useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

export function ChartView({
  chordpro,
  chords,
  activeChord = null,
  cursorIndex = -1,
}: {
  chordpro: string;
  chords?: string[]; // authoritative chord list from the backend song model
  activeChord?: string | null;
  cursorIndex?: number;
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
    const tokens = root.querySelectorAll<HTMLElement>(".chord");
    tokens.forEach((el, i) => {
      const hit = !!activeChord && el.textContent?.trim() === activeChord;
      el.classList.toggle("chord-active", hit);
      el.classList.toggle("chord-cursor", i === cursorIndex);
    });
    if (cursorIndex >= 0 && tokens[cursorIndex]) {
      tokens[cursorIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeChord, cursorIndex, html]);

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
