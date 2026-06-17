import time
import uuid
from dataclasses import dataclass, field
from .models import SessionSummary, Song

# Domain objects + the in-memory repo (local dev / no DATABASE_URL fallback).
# PgRepo (persistence.py) implements the same surface against Postgres so
# sessions + imported songs survive a reload (spec §7 schema).


@dataclass
class CoachingTurn:
    seq: int
    content: str
    input_tokens: int
    output_tokens: int


@dataclass
class Session:
    id: str
    song_id: str | None
    mode: str
    created_at: float = field(default_factory=time.time)
    status: str = "active"
    latest_summary: SessionSummary | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    turns: list[CoachingTurn] = field(default_factory=list)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


def new_session_id() -> str:
    return uuid.uuid4().hex


class MemoryRepo:
    def __init__(self) -> None:
        self._s: dict[str, Session] = {}
        self._imports: dict[str, Song] = {}
        self._blobs: dict[str, bytes] = {}

    # --- sessions ---
    def create_session(self, song_id: str | None, mode: str) -> Session:
        s = Session(id=new_session_id(), song_id=song_id, mode=mode)
        self._s[s.id] = s
        return s

    def get_session(self, sid: str) -> Session | None:
        return self._s.get(sid)

    def set_summary(self, sid: str, summary: SessionSummary) -> None:
        self._s[sid].latest_summary = summary

    def add_turn(self, sid: str, content: str, in_tok: int, out_tok: int) -> None:
        s = self._s[sid]
        s.input_tokens += in_tok
        s.output_tokens += out_tok
        s.turns.append(CoachingTurn(len(s.turns), content, in_tok, out_tok))

    # --- imported songs ---
    def save_import(self, song: Song, blob: bytes | None = None) -> None:
        self._imports[song.id] = song
        if blob is not None:
            self._blobs[song.id] = blob

    def list_imports(self) -> dict[str, Song]:
        return dict(self._imports)

    def get_blob(self, song_id: str) -> bytes | None:
        return self._blobs.get(song_id)

    def update_import(self, song: Song) -> None:
        self._imports[song.id] = song

    def delete_import(self, song_id: str) -> None:
        self._imports.pop(song_id, None)
        self._blobs.pop(song_id, None)
