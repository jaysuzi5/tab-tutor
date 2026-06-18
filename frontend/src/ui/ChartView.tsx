// ChordPro sheet in a fixed-height scroll box. Scroll is CONTINUOUS, driven by
// song progress (0..1) so it glides smoothly at tempo instead of jumping per
// chord. Per-chord coloring still uses the cursor index. Manual scroll pauses
// auto-scroll; auto-scroll only happens while playing.

import { useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

export function ChartView({
  chordpro,
  activeChord = null,
  cursorIndex = -1,
  cursorState = null,
  scrollOnly = false,
  playing = false,
  progress = 0,
}: {
  chordpro: string;
  activeChord?: string | null;
  cursorIndex?: number;
  cursorState?: "pending" | "hit" | "miss" | null;
  scrollOnly?: boolean;
  playing?: boolean;
  progress?: number; // 0..1 through the song
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const html = useMemo(() => {
    const song = new ChordSheetJS.ChordProParser().parse(chordpro);
    return new ChordSheetJS.HtmlDivFormatter().format(song);
  }, [chordpro]);

  // New run resets the manual-scroll lock.
  useEffect(() => {
    if (playing) userScrolledRef.current = false;
  }, [playing]);

  // User scroll while playing -> stop auto-scrolling (don't fight them).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onUser = () => {
      if (playing) userScrolledRef.current = true;
    };
    box.addEventListener("wheel", onUser, { passive: true });
    box.addEventListener("touchmove", onUser, { passive: true });
    return () => {
      box.removeEventListener("wheel", onUser);
      box.removeEventListener("touchmove", onUser);
    };
  }, [playing]);

  // Per-chord coloring (no scrolling here).
  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
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
    // Measure / riff lines (start with "|") render monospace so the bars align.
    root.querySelectorAll<HTMLElement>(".lyrics").forEach((el) => {
      el.classList.toggle("measure", (el.textContent ?? "").trim().startsWith("|"));
    });
  }, [activeChord, cursorIndex, cursorState, scrollOnly, html]);

  // Continuous auto-scroll: map progress onto the scrollable range. Only while
  // playing and only if the user hasn't taken over.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !playing || userScrolledRef.current) return;
    const max = box.scrollHeight - box.clientHeight;
    box.scrollTop = Math.max(0, Math.min(max, progress * max));
  }, [progress, playing]);

  return (
    <div className="chart">
      <div ref={boxRef} className="chart-scroll">
        <div ref={sheetRef} className="chordsheet" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
