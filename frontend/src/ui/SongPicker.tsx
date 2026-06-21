// Song selector + add/edit. Built-in library + user paste (chords-above-lyrics)
// and Guitar Pro/MusicXML upload. Editing lets you fix the linked Spotify track
// via search. No scraping / no PDF.

import { useEffect, useState } from "react";
import {
  importText, importFile, getSong, updateSong, deleteSong,
  spotifySearch, type SongMeta, type SpotifyTrack, type StrumPattern,
} from "../api";
import { StrumEditor } from "./StrumEditor";

// Bookmarklet: reads the live UG store on a chord page and POSTs the tab JSON
// to our import endpoint (text/plain to skip the CORS preflight).
function ugBookmarklet(): string {
  const api = `${location.origin}/api/songs/import/ug-data`;
  const code = `(function(){try{var d=window.UGAPP.store.page.data,t=d.tab,v=d.tab_view;var b=JSON.stringify({title:t.song_name,artist:t.artist_name,key:t.tonality_name||(v.meta&&v.meta.tonality),capo:(v.meta&&v.meta.capo)||0,content:v.wiki_tab.content,simplify:true});fetch(${JSON.stringify(api)},{method:'POST',headers:{'Content-Type':'text/plain'},body:b}).then(function(r){return r.json()}).then(function(s){alert('Added to Tab Tutor: '+(s.title||'song'))}).catch(function(e){alert('Tab Tutor import failed: '+e)})}catch(e){alert('Open a chord page on Ultimate Guitar first.')}})();`;
  return "javascript:" + code;
}

export function SongPicker({
  songs,
  selectedId,
  onImported,
  onPanelOpen,
}: {
  songs: SongMeta[];
  selectedId: string;
  onImported: (id: string) => void;
  onPanelOpen?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cp, setCp] = useState("");
  const [title, setTitle] = useState("");
  const [pArtist, setPArtist] = useState("");
  const [pBpm, setPBpm] = useState("");
  const [pKey, setPKey] = useState("");
  const [pCapo, setPCapo] = useState(0);
  const [pStrums, setPStrums] = useState<StrumPattern[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eArtist, setEArtist] = useState("");
  const [eSpotify, setESpotify] = useState("");
  const [eChordpro, setEChordpro] = useState("");
  const [eStrums, setEStrums] = useState<StrumPattern[]>([]);
  const [eBpm, setEBpm] = useState(80);
  const [eKey, setEKey] = useState("");
  const [eCapo, setECapo] = useState(0);
  const [eQuery, setEQuery] = useState("");
  const [eResults, setEResults] = useState<SpotifyTrack[]>([]);

  const selected = songs.find((s) => s.id === selectedId);
  const canEdit = !!selected && !selected.isBuiltin;

  // Tell the page when a panel is open so it can hide the song below.
  useEffect(() => onPanelOpen?.(open || editing), [open, editing, onPanelOpen]);

  const openEdit = async () => {
    setErr(null);
    try {
      const full = await getSong(selectedId);
      setETitle(full.title ?? "");
      setEArtist(full.artist ?? "");
      setESpotify(full.spotifyUri ?? "");
      setEChordpro(full.chordpro ?? "");
      setEStrums(full.strumming ?? []);
      setEBpm(full.tempo ?? 80);
      setEKey(full.key ?? "");
      setECapo(full.capo ?? 0);
      setEQuery(`${full.title ?? ""} ${full.artist ?? ""}`.trim());
      setEResults([]);
      setOpen(false);
      setEditing(true);
    } catch {
      setErr("couldn't load song");
    }
  };

  const searchSpotify = async (e: React.FormEvent) => {
    e.preventDefault();
    setEResults(await spotifySearch(eQuery));
  };

  const saveEdit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await updateSong(selectedId, {
        title: eTitle, artist: eArtist, bpm: eBpm, key: eKey, capo: eCapo,
        spotifyUri: eSpotify, chordpro: eChordpro,
        strumming: eStrums.filter((s) => s.slots && s.slots.length > 0),
      });
      setEditing(false);
      onImported(selectedId);
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
      onImported("");
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
      setCp(""); setTitle(""); setPArtist(""); setPBpm(""); setPKey(""); setPCapo(0); setPStrums([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="songpicker">
      <div className="songpicker-row">
        <button onClick={() => { setEditing(false); setOpen((o) => !o); }}>
          {open ? "Close" : "+ Add Song"}
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
            <div className="paste-fields">
              <input
                type="number"
                placeholder="BPM"
                value={eBpm || ""}
                onChange={(e) => setEBpm(Number(e.target.value))}
              />
              <input placeholder="Key" value={eKey} onChange={(e) => setEKey(e.target.value)} />
              <label className="capo-field">
                Capo
                <select value={eCapo} onChange={(e) => setECapo(Number(e.target.value))}>
                  {Array.from({ length: 13 }, (_, n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <h4>Spotify track</h4>
            <p className="muted small">
              Linked: {eSpotify ? <code>{eSpotify}</code> : "none"}
            </p>
            <form className="spotify-search" onSubmit={searchSpotify}>
              <input
                placeholder="Search Spotify (title artist)…"
                value={eQuery}
                onChange={(e) => setEQuery(e.target.value)}
              />
              <button type="submit" disabled={!eQuery.trim()}>Search</button>
            </form>
            {eResults.length > 0 && (
              <ul className="spotify-results">
                {eResults.map((t) => (
                  <li key={t.uri}>
                    <button
                      className={eSpotify === t.uri ? "active" : ""}
                      onClick={() => setESpotify(t.uri)}
                    >
                      <strong>{t.name}</strong>{" "}
                      <span className="muted">{t.artists}{t.album ? ` · ${t.album}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              placeholder="Spotify URI (spotify:track:...)"
              value={eSpotify}
              onChange={(e) => setESpotify(e.target.value)}
            />

            <h4>Chords</h4>
            <textarea rows={8} value={eChordpro} onChange={(e) => setEChordpro(e.target.value)} />
            <StrumEditor value={eStrums} onChange={setEStrums} defaultBpm={eBpm} />
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
              <input type="number" placeholder="BPM" value={pBpm} onChange={(e) => setPBpm(e.target.value)} />
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
                    strumming: pStrums.filter((s) => s.slots && s.slots.length > 0),
                  }),
                )
              }
            >
              {busy ? "Converting…" : "Convert & save"}
            </button>
            <p className="muted small">
              Paste chords-above-lyrics text. We align the chords, build the chart,
              and link the Spotify track (you can fix it later via Edit).
            </p>
            <StrumEditor value={pStrums} onChange={setPStrums} defaultBpm={pBpm ? Number(pBpm) : 80} />
          </div>

          <div className="import-block">
            <h4>From Ultimate Guitar</h4>
            <p className="muted small">
              UG pages are bot-protected, so this can't be fetched by URL. Drag
              the button below to your bookmarks bar, then click it while viewing
              a chord page — it sends the tab here (simplified chords).
            </p>
            <a className="bookmarklet" href={ugBookmarklet()} onClick={(e) => e.preventDefault()}>
              🎸 Add to Tab Tutor
            </a>
            <p className="muted small">
              After running it on a UG page, reopen this dropdown to see the song.
            </p>
          </div>

          <div className="import-block">
            <h4>Upload Guitar Pro / MusicXML</h4>
            <input
              type="file"
              accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handle(() => importFile(f));
              }}
            />
            <p className="muted small">Renders as real tab with a play-along cursor.</p>
          </div>

          {err && <p className="import-err">{err}</p>}
        </div>
      )}
    </div>
  );
}
