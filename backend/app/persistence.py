import json
from psycopg_pool import ConnectionPool
from .models import SessionSummary, Song
from .store import Session, CoachingTurn, new_session_id

# Postgres-backed repo (CloudNativePG). Mirrors MemoryRepo so sessions +
# imported songs persist across restarts/reloads. Schema matches spec §7;
# the progress table is created but unused in MVP (the moat is a migration).

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  song_id TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  latest_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS coaching_turns (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  content TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT, key TEXT, tempo INT, capo INT, difficulty TEXT,
  chords JSONB NOT NULL DEFAULT '[]', license TEXT, source TEXT,
  format TEXT NOT NULL DEFAULT 'chordpro',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  chordpro TEXT NOT NULL DEFAULT '',
  spotify_uri TEXT,
  strumming JSONB NOT NULL DEFAULT '[]',
  blob BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill for clusters created before these columns existed.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS spotify_uri TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS strumming JSONB NOT NULL DEFAULT '[]';
-- Schema-ready for the per-user progress moat (unused in MVP).
CREATE TABLE IF NOT EXISTS progress (
  user_key TEXT PRIMARY KEY,
  mastery JSONB NOT NULL DEFAULT '{}',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class PgRepo:
    def __init__(self, dsn: str) -> None:
        self.pool = ConnectionPool(dsn, min_size=1, max_size=5, open=True)
        with self.pool.connection() as conn:
            conn.execute(_SCHEMA)

    # --- sessions ---
    def create_session(self, song_id: str | None, mode: str) -> Session:
        sid = new_session_id()
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO sessions (id, song_id, mode) VALUES (%s,%s,%s)",
                (sid, song_id, mode),
            )
        return Session(id=sid, song_id=song_id, mode=mode)

    def get_session(self, sid: str) -> Session | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT id, song_id, mode, status, input_tokens, output_tokens, latest_summary "
                "FROM sessions WHERE id=%s",
                (sid,),
            ).fetchone()
            if not row:
                return None
            turns = conn.execute(
                "SELECT seq, content, input_tokens, output_tokens FROM coaching_turns "
                "WHERE session_id=%s ORDER BY seq",
                (sid,),
            ).fetchall()
        s = Session(id=row[0], song_id=row[1], mode=row[2], status=row[3],
                    input_tokens=row[4], output_tokens=row[5])
        if row[6]:
            s.latest_summary = SessionSummary.model_validate(row[6])
        s.turns = [CoachingTurn(t[0], t[1], t[2], t[3]) for t in turns]
        return s

    def set_summary(self, sid: str, summary: SessionSummary) -> None:
        payload = json.dumps(summary.model_dump(by_alias=True))
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE sessions SET latest_summary=%s::jsonb WHERE id=%s", (payload, sid)
            )
            seq = conn.execute(
                "SELECT count(*) FROM session_events WHERE session_id=%s", (sid,)
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO session_events (session_id, seq, summary) VALUES (%s,%s,%s::jsonb)",
                (sid, seq, payload),
            )

    def add_turn(self, sid: str, content: str, in_tok: int, out_tok: int) -> None:
        with self.pool.connection() as conn:
            seq = conn.execute(
                "SELECT count(*) FROM coaching_turns WHERE session_id=%s", (sid,)
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO coaching_turns (session_id, seq, content, input_tokens, output_tokens) "
                "VALUES (%s,%s,%s,%s,%s)",
                (sid, seq, content, in_tok, out_tok),
            )
            conn.execute(
                "UPDATE sessions SET input_tokens=input_tokens+%s, output_tokens=output_tokens+%s "
                "WHERE id=%s",
                (in_tok, out_tok, sid),
            )

    # --- imported songs ---
    def save_import(self, song: Song, blob: bytes | None = None) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO songs (id,title,artist,key,tempo,capo,difficulty,chords,license,"
                "source,format,is_builtin,chordpro,spotify_uri,strumming,blob) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s::jsonb,%s) "
                "ON CONFLICT (id) DO NOTHING",
                (song.id, song.title, song.artist, song.key, song.tempo, song.capo,
                 song.difficulty, json.dumps(song.chords), song.license, song.source,
                 song.format, song.isBuiltin, song.chordpro, song.spotifyUri,
                 json.dumps([s.model_dump() for s in song.strumming]), blob),
            )

    def list_imports(self) -> dict[str, Song]:
        with self.pool.connection() as conn:
            rows = conn.execute(
                "SELECT id,title,artist,key,tempo,capo,difficulty,chords,license,source,"
                "format,is_builtin,chordpro,spotify_uri,strumming FROM songs WHERE is_builtin=false "
                "ORDER BY created_at"
            ).fetchall()
        out: dict[str, Song] = {}
        for r in rows:
            out[r[0]] = Song(
                id=r[0], title=r[1], artist=r[2], key=r[3], tempo=r[4], capo=r[5],
                difficulty=r[6], chords=r[7] or [], license=r[8], source=r[9],
                format=r[10], isBuiltin=r[11], chordpro=r[12], spotifyUri=r[13],
                strumming=r[14] or [],
            )
        return out

    def get_blob(self, song_id: str) -> bytes | None:
        with self.pool.connection() as conn:
            row = conn.execute("SELECT blob FROM songs WHERE id=%s", (song_id,)).fetchone()
        return bytes(row[0]) if row and row[0] is not None else None

    def update_import(self, song: Song) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE songs SET title=%s, artist=%s, key=%s, tempo=%s, capo=%s, chords=%s::jsonb, "
                "chordpro=%s, spotify_uri=%s, strumming=%s::jsonb WHERE id=%s AND is_builtin=false",
                (song.title, song.artist, song.key, song.tempo, song.capo, json.dumps(song.chords),
                 song.chordpro, song.spotifyUri,
                 json.dumps([s.model_dump() for s in song.strumming]), song.id),
            )

    def delete_import(self, song_id: str) -> None:
        with self.pool.connection() as conn:
            conn.execute("DELETE FROM songs WHERE id=%s AND is_builtin=false", (song_id,))
