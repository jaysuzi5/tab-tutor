// Renders the ChordPro sheet inside a fixed-height scroll container with a
// beat-synced cursor + per-chord color feedback. Metadata/chord cards live on
// the page; this is just the scrolling chart.

import { useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

export function ChartView({
  chordpro,
  activeChord = null,
  cursorIndex = -1,
  cursorState = null,
  scrollOnly = false,
  playing = false,
  done = false,
}: {
  chordpro: string;
  activeChord?: string | null;
  cursorIndex?: number;
  cursorState?: "pending" | "hit" | "miss" | null;
  scrollOnly?: boolean;
  playing?: boolean;
  done?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const html = useMemo(() => {
    const song = new ChordSheetJS.ChordProParser().parse(chordpro);
    return new ChordSheetJS.HtmlDivFormatter().format(song);
  }, [chordpro]);

  useEffect(() => {
    if (playing) userScrolledRef.current = false;
  }, [playing]);
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
    if (cursorIndex >= 0 && tokens[cursorIndex] && !userScrolledRef.current) {
      // Center the active chord within the scroll box (instant — smooth lagged
      // behind fast cursor moves and let the active line drift off screen).
      tokens[cursorIndex].scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [activeChord, cursorIndex, cursorState, scrollOnly, html]);

  useEffect(() => {
    if (done && boxRef.current && !userScrolledRef.current) {
      boxRef.current.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [done]);

  return (
    <div className="chart">
      <div ref={boxRef} className="chart-scroll">
        <div ref={sheetRef} className="chordsheet" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
