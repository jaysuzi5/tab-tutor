// Backend API client. Coaching streams over SSE; we read the fetch body as a
// stream so both GET (coach) and POST (ask) share one parser.

import type { SessionSummary } from "./engine/scorer";

export interface SongMeta {
  id: string;
  title: string;
  artist?: string | null;
  tempo?: number | null;
  difficulty?: string | null;
  chords: string[];
  license?: string | null;
  source?: string | null;
  format: string; // chordpro | gp | musicxml
  spotifyUri?: string | null;
  isBuiltin: boolean;
}

export interface StrumPattern {
  label: string;
  bpm: number;
  subdivision: "eighth" | "triplet";
  slots: string[]; // "D" | "U" | ""
}

export interface Song extends SongMeta {
  key?: string | null;
  capo?: number | null;
  chordpro: string;
  strumming?: StrumPattern[];
}

export async function listSongs(): Promise<SongMeta[]> {
  const r = await fetch("/api/songs");
  if (!r.ok) throw new Error("listSongs failed");
  return r.json();
}

export async function getSong(id: string): Promise<Song> {
  const r = await fetch(`/api/songs/${id}`);
  if (!r.ok) throw new Error("getSong failed");
  return r.json();
}

export async function importChordPro(text: string, title?: string): Promise<Song> {
  const r = await fetch("/api/songs/import/chordpro", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, title }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "import failed");
  return r.json();
}

export async function importFile(file: File): Promise<Song> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/songs/import/file", { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "import failed");
  return r.json();
}

export interface TextImport {
  title: string;
  artist?: string;
  bpm?: number;
  key?: string;
  capo?: number;
  text: string;
  strumming?: StrumPattern[];
}

export async function importText(req: TextImport): Promise<Song> {
  const r = await fetch("/api/songs/import/text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "import failed");
  return r.json();
}

export async function importPdf(file: File): Promise<Song> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/songs/import/pdf", { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "PDF import failed");
  return r.json();
}

export interface SongPatch {
  title?: string;
  artist?: string;
  chordpro?: string;
  spotifyUri?: string;
  strumming?: StrumPattern[];
}

export async function updateSong(id: string, patch: SongPatch): Promise<Song> {
  const r = await fetch(`/api/songs/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("update failed");
  return r.json();
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: string;
  album: string;
}

export async function spotifySearch(q: string): Promise<SpotifyTrack[]> {
  const r = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  return (await r.json()).tracks ?? [];
}

export async function deleteSong(id: string): Promise<void> {
  const r = await fetch(`/api/songs/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete failed");
}

export const songFileUrl = (id: string) => `/api/songs/${id}/file`;

export interface CoachChunk {
  delta?: string;
  done?: boolean;
  usage?: { input: number; output: number };
  totalTokens?: number;
  capped?: boolean;
  error?: string;
}

export async function createSession(
  songId: string | null,
  mode: string,
): Promise<string> {
  const r = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ songId, mode }),
  });
  if (!r.ok) throw new Error("createSession failed");
  return (await r.json()).id;
}

export async function postEvents(sid: string, summary: SessionSummary) {
  await fetch(`/api/session/${sid}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary }),
  });
}

// Reads an SSE response, invoking onChunk per `data:` line.
async function readSSE(res: Response, onChunk: (c: CoachChunk) => void) {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.split("\n").find((l) => l.startsWith("data:"));
      if (line) onChunk(JSON.parse(line.slice(5).trim()));
    }
  }
}

export async function streamCoach(sid: string, onChunk: (c: CoachChunk) => void) {
  const res = await fetch(`/api/session/${sid}/coach/stream`);
  await readSSE(res, onChunk);
}

export async function streamAsk(
  sid: string,
  question: string,
  onChunk: (c: CoachChunk) => void,
) {
  const res = await fetch(`/api/session/${sid}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  await readSSE(res, onChunk);
}
