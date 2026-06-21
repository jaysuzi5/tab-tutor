// Left sidebar: songs grouped by artist, each artist collapsible (expanded by
// default). Replaces the dropdown once the library gets large.

import { useMemo, useState } from "react";
import type { SongMeta } from "../api";

export function SongList({
  songs,
  selectedId,
  onSelect,
}: {
  songs: SongMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, SongMeta[]>();
    for (const s of songs) {
      const a = (s.artist || "Unknown").trim() || "Unknown";
      if (!m.has(a)) m.set(a, []);
      m.get(a)!.push(s);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([artist, list]) =>
        [artist, list.sort((x, y) => x.title.localeCompare(y.title))] as const,
      );
  }, [songs]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (a: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      n.has(a) ? n.delete(a) : n.add(a);
      return n;
    });

  return (
    <div className="song-sidebar">
      {songs.length === 0 && <p className="muted small">No songs yet — add one.</p>}
      {groups.map(([artist, list]) => (
        <div key={artist} className="song-group">
          <button className="song-group-head" onClick={() => toggle(artist)}>
            <span className="caret">{collapsed.has(artist) ? "▸" : "▾"}</span>
            {artist}
          </button>
          {!collapsed.has(artist) &&
            list.map((s) => (
              <button
                key={s.id}
                className={`song-item ${s.id === selectedId ? "active" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                {s.title}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
