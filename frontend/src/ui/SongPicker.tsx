// Song selector + import. Three entry paths (spec §5): built-in library,
// user import (ChordPro paste or Guitar Pro/MusicXML upload), and link-out.
// We never scrape or republish — link-out just opens the user's URL.

import { useRef, useState } from "react";
import {
  importChordPro, importFile, importPdf, getSong, updateSong, deleteSong,
  type SongMeta,
} from "../api";

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
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit state for the selected (imported) song.
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eArtist, setEArtist] = useState("");
  const [eSpotify, setESpotify] = useState("");
  const [eChordpro, setEChordpro] = useState("");

  const selected = songs.find((s) => s.id === selectedId);
  const canEdit = !!selected && !selected.isBuiltin;

  const openEdit = async () => {
    setErr(null);
    try {
      const full = await getSong(selectedId);
      setETitle(full.title ?? "");
      setEArtist(full.artist ?? "");
      setESpotify(full.spotifyUri ?? "");
      setEChordpro(full.chordpro ?? "");
      setOpen(false);
      setEditing(true);
    } catch {
      setErr("couldn't load song");
    }
  };

  const saveEdit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await updateSong(selectedId, {
        title: eTitle, artist: eArtist, spotifyUri: eSpotify, chordpro: eChordpro,
      });
      setEditing(false);
      onImported(selectedId); // refresh list, keep selection
    } catch {
      setErr("save failed");
    } finally {
      setBusy(false);
    }
  };

  const removeSong = async () => {
    if (!confirm(`Delete "${selected?.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteSong(selectedId);
      onImported(""); // refresh; selection falls back to first song
    } catch {
      setErr("delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handle = async (fn: () => Promise<{ id: string }>) => {
    setErr(null);
    setBusy(true);
    try {
      const s = await fn();
      onImported(s.id);
      setOpen(false);
      setCp("");
      setTitle("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "import failed");
    } finally {
      setBusy(false);
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
        <button onClick={() => { setEditing(false); setOpen((o) => !o); }}>
          {open ? "Close" : "Import"}
        </button>
        {canEdit && (
          <>
            <button onClick={openEdit} disabled={busy}>Edit</button>
            <button className="danger" onClick={removeSong} disabled={busy}>Delete</button>
          </>
        )}
      </div>

      {editing && (
        <div className="import-panel">
          <div className="import-block">
            <h4>Edit song</h4>
            <input placeholder="Title" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
            <input placeholder="Artist" value={eArtist} onChange={(e) => setEArtist(e.target.value)} />
            <input
              placeholder="Spotify URI (spotify:track:...)"
              value={eSpotify}
              onChange={(e) => setESpotify(e.target.value)}
            />
            <textarea
              rows={8}
              value={eChordpro}
              onChange={(e) => setEChordpro(e.target.value)}
            />
            <div className="edit-actions">
              <button onClick={saveEdit} disabled={busy}>Save</button>
              <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
            {err && <p className="import-err">{err}</p>}
          </div>
        </div>
      )}

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
            <h4>Upload a chord-sheet PDF</h4>
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handle(() => importPdf(f));
              }}
            />
            <p className="muted small">
              {busy
                ? "Converting… reading the PDF and matching the Spotify track."
                : "Any chord-sheet PDF — we convert it to a playable chart and link the Spotify track."}
            </p>
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
