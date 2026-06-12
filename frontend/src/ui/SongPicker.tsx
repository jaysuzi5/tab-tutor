// Song selector + import. Three entry paths (spec §5): built-in library,
// user import (ChordPro paste or Guitar Pro/MusicXML upload), and link-out.
// We never scrape or republish — link-out just opens the user's URL.

import { useRef, useState } from "react";
import { importChordPro, importFile, type SongMeta } from "../api";

export function SongPicker({
  songs,
  selectedId,
  onSelect,
  onImported,
}: {
  songs: SongMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
  onImported: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cp, setCp] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (fn: () => Promise<{ id: string }>) => {
    setErr(null);
    try {
      const s = await fn();
      onImported(s.id);
      setOpen(false);
      setCp("");
      setTitle("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "import failed");
    }
  };

  return (
    <div className="songpicker">
      <div className="songpicker-row">
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          {songs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isBuiltin ? "★ " : "↑ "}
              {s.title}
              {s.artist ? ` — ${s.artist}` : ""} [{s.format}]
            </option>
          ))}
        </select>
        <button onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Import"}
        </button>
      </div>

      {open && (
        <div className="import-panel">
          <div className="import-block">
            <h4>Paste a ChordPro / chord sheet</h4>
            <input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              rows={5}
              placeholder={"{title: ...}\n[G]Your [C]chords [D]here"}
              value={cp}
              onChange={(e) => setCp(e.target.value)}
            />
            <button
              disabled={!cp.trim()}
              onClick={() => handle(() => importChordPro(cp, title || undefined))}
            >
              Save chord sheet
            </button>
          </div>

          <div className="import-block">
            <h4>Upload Guitar Pro / MusicXML</h4>
            <input
              ref={fileRef}
              type="file"
              accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handle(() => importFile(f));
              }}
            />
            <p className="muted small">Renders as real tab with a play-along cursor.</p>
          </div>

          <div className="import-block">
            <h4>Have a tab on another site?</h4>
            <div className="linkout">
              <input
                placeholder="Paste a tab URL (Ultimate Guitar, Songsterr…)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                disabled={!/^https?:\/\//.test(url)}
                onClick={() => window.open(url, "_blank", "noopener")}
              >
                Open
              </button>
            </div>
            <p className="muted small">
              We link out — we don't copy or host other sites' tabs.
            </p>
          </div>

          {err && <p className="import-err">{err}</p>}
        </div>
      )}
    </div>
  );
}
