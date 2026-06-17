// Song selector + import. Three entry paths (spec §5): built-in library,
// user import (ChordPro paste or Guitar Pro/MusicXML upload), and link-out.
// We never scrape or republish — link-out just opens the user's URL.

import { useRef, useState } from "react";
import {
  importText, importFile, importPdf, getSong, updateSong, deleteSong,
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
  const [pArtist, setPArtist] = useState("");
  const [pBpm, setPBpm] = useState("");
  const [pKey, setPKey] = useState("");
  const [pCapo, setPCapo] = useState(0);
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
      setPArtist("");
      setPBpm("");
      setPKey("");
      setPCapo(0);
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
            <h4>Paste a chord sheet (chords above lyrics)</h4>
            <div className="paste-fields">
              <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input placeholder="Singer / artist" value={pArtist} onChange={(e) => setPArtist(e.target.value)} />
              <input
                type="number"
                placeholder="BPM"
                value={pBpm}
                onChange={(e) => setPBpm(e.target.value)}
              />
              <input placeholder="Key" value={pKey} onChange={(e) => setPKey(e.target.value)} />
              <label className="capo-field">
                Capo
                <select value={pCapo} onChange={(e) => setPCapo(Number(e.target.value))}>
                  {Array.from({ length: 13 }, (_, n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              className="mono"
              rows={10}
              placeholder={"[Verse]\n      G        Em\nI found a love for me"}
              value={cp}
              onChange={(e) => setCp(e.target.value)}
            />
            <button
              disabled={!cp.trim() || !title.trim() || busy}
              onClick={() =>
                handle(() =>
                  importText({
                    title,
                    artist: pArtist || undefined,
                    bpm: pBpm ? Number(pBpm) : undefined,
                    key: pKey || undefined,
                    capo: pCapo,
                    text: cp,
                  }),
                )
              }
            >
              {busy ? "Converting…" : "Convert & save"}
            </button>
            <p className="muted small">
              Paste chords-above-lyrics text. We align the chords, build the chart,
              and link the Spotify track.
            </p>
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
