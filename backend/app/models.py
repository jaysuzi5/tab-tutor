from typing import Optional
from pydantic import BaseModel, Field

# Mirrors the client SessionSummary (engine/scorer.ts) — the ONLY play data
# that reaches the tutor. Never raw audio, never per-note events.


class ChordStat(BaseModel):
    hits: int = 0
    misses: int = 0
    avgTimingErrMs: Optional[float] = None


class TransitionMiss(BaseModel):
    from_: str = Field(alias="from")
    to: str
    count: int

    model_config = {"populate_by_name": True}


class SessionSummary(BaseModel):
    v: int = 1
    songId: Optional[str] = None
    mode: str = "free"
    tempoTarget: Optional[int] = None
    tempoAchieved: Optional[int] = None
    totalEvents: int = 0
    perChord: dict[str, ChordStat] = {}
    recurringMisses: list[TransitionMiss] = []
    cleanRunPct: int = 0
    lowConfidence: bool = False


class CreateSessionReq(BaseModel):
    songId: Optional[str] = None
    mode: str = "learn"


class EventsReq(BaseModel):
    summary: SessionSummary


class AskReq(BaseModel):
    question: str


class CoachReq(BaseModel):
    # Optional override; otherwise the session's latest stored summary is used.
    summary: Optional[SessionSummary] = None


class SongMeta(BaseModel):
    id: str
    title: str
    artist: Optional[str] = None
    key: Optional[str] = None
    tempo: Optional[int] = None
    capo: Optional[int] = None
    difficulty: Optional[str] = None
    chords: list[str] = []
    license: Optional[str] = None
    source: Optional[str] = None
    format: str = "chordpro"  # chordpro | gp | musicxml
    spotifyUri: Optional[str] = None  # linked Spotify track for play-along
    isBuiltin: bool = True


class StrumPattern(BaseModel):
    label: str = ""                 # note/comment, e.g. "Verse"
    bpm: int = 0                    # 0 => use the song tempo
    subdivision: str = "eighth"     # eighth (8 slots/bar) | triplet (12)
    slots: list[str] = []           # per slot: "D" down, "U" up, "" rest


class Song(SongMeta):
    chordpro: str = ""  # empty for binary formats (Guitar Pro / MusicXML)
    strumming: list[StrumPattern] = []


class ImportChordProReq(BaseModel):
    text: str
    title: str | None = None


class ImportTextReq(BaseModel):
    title: str
    artist: Optional[str] = None
    bpm: Optional[int] = None
    key: Optional[str] = None
    capo: Optional[int] = None
    text: str
    strumming: list[StrumPattern] = []


class PatchSongReq(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    chordpro: Optional[str] = None
    spotifyUri: Optional[str] = None
    strumming: Optional[list[StrumPattern]] = None
