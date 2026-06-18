// ChordPro sheet in a fixed-height scroll box with continuous (bpm-driven)
// autoscroll + per-chord coloring. Measure/riff lines (start with "|") are
// rendered by a custom inline renderer so exact spacing is preserved and
// bracketed chords show green inline — chordsheetjs would raise them and
// collapse the spaces.

import { Fragment, useEffect, useMemo, useRef } from "react";
import ChordSheetJS from "chordsheetjs";

interface Block {
  measure: boolean;
  // sheet block -> html; measure block -> raw line
  html?: string;
  text?: string;
}

function buildBlocks(chordpro: string): Block[] {
  const lines = chordpro.split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const song = new ChordSheetJS.ChordProParser().parse(buf.join("\n"));
    blocks.push({ measure: false, html: new ChordSheetJS.HtmlDivFormatter().format(song) });
    buf = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      flush();
      blocks.push({ measure: true, text: line });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

// Render a measure line: [C] -> green chord span, everything else verbatim.
function renderMeasure(text: string) {
  const parts = text.split(/(\[[^\]]+\])/);
  return parts.map((p, i) => {
    const m = p.match(/^\[([^\]]+)\]$/);
    return m ? (
      <span key={i} className="chord measure-chord">{m[1]}</span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    );
  });
}

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
  progress?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const blocks = useMemo(() => buildBlocks(chordpro), [chordpro]);

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

  // Per-chord coloring across all blocks (document order matches the timeline).
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
  }, [activeChord, cursorIndex, cursorState, scrollOnly, blocks]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !playing || userScrolledRef.current) return;
    const max = box.scrollHeight - box.clientHeight;
    box.scrollTop = Math.max(0, Math.min(max, progress * max));
  }, [progress, playing]);

  return (
    <div className="chart">
      <div ref={boxRef} className="chart-scroll">
        <div ref={sheetRef} className="chordsheet">
          {blocks.map((b, i) =>
            b.measure ? (
              <div key={i} className="measure-line">{renderMeasure(b.text!)}</div>
            ) : (
              <div key={i} dangerouslySetInnerHTML={{ __html: b.html! }} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
