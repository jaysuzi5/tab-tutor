import re
from pathlib import Path
from .config import get_settings
from .models import Song, SongMeta

# Built-in library = versioned public-domain/CC ChordPro files (spec §5).
# Parsed into the normalized Song model so the engine/renderer don't care where
# a song came from. User imports (step 5) land in the same shape.

_DIRECTIVE = re.compile(r"\{(\w+):\s*([^}]*)\}")


def _parse(text: str, song_id: str) -> Song:
    meta: dict[str, str] = {}
    for m in _DIRECTIVE.finditer(text):
        meta[m.group(1).lower()] = m.group(2).strip()

    def as_int(key: str):
        v = meta.get(key)
        try:
            return int(v) if v else None
        except ValueError:
            return None

    chords = [c for c in re.split(r"\s+", meta.get("chords", "")) if c]
    return Song(
        id=song_id,
        title=meta.get("title", song_id),
        artist=meta.get("artist"),
        key=meta.get("key"),
        tempo=as_int("tempo"),
        capo=as_int("capo"),
        difficulty=meta.get("difficulty"),
        chords=chords,
        license=meta.get("license"),
        source=meta.get("source"),
        format="chordpro",
        isBuiltin=True,
        chordpro=text,
    )


def _dir() -> Path:
    # songs_dir is relative to repo root; resolve from CWD or two levels up.
    s = get_settings()
    for base in (Path.cwd(), Path(__file__).resolve().parents[2]):
        p = base / s.songs_dir
        if p.is_dir():
            return p
    return Path(s.songs_dir)


def load_builtins() -> dict[str, Song]:
    out: dict[str, Song] = {}
    for f in sorted(_dir().glob("*.cho")):
        out[f.stem] = _parse(f.read_text(encoding="utf-8"), f.stem)
    return out


_CACHE: dict[str, Song] | None = None

# User imports persist via the repo (Postgres when configured, else in-memory).
# Extension -> normalized format. alphaTab reads gp*/musicxml; chordpro is text.
_FMT = {
    ".gp": "gp", ".gp3": "gp", ".gp4": "gp", ".gp5": "gp", ".gpx": "gp",
    ".xml": "musicxml", ".musicxml": "musicxml", ".mxl": "musicxml",
}


def all_songs() -> dict[str, Song]:
    global _CACHE
    if _CACHE is None:
        _CACHE = load_builtins()
    from .repo import REPO
    return {**_CACHE, **REPO.list_imports()}


def import_chordpro(text: str, title: str | None) -> Song:
    import uuid
    from .repo import REPO
    sid = "imp-" + uuid.uuid4().hex[:8]
    song = _parse(text, sid)
    song.isBuiltin = False
    song.format = "chordpro"
    if title:
        song.title = title
    song.source = "user import"
    song.license = song.license or "user-supplied"
    REPO.save_import(song)
    return song


def import_file(filename: str, data: bytes) -> Song:
    import uuid
    from pathlib import PurePath
    from .repo import REPO
    ext = PurePath(filename).suffix.lower()
    fmt = _FMT.get(ext)
    if not fmt:
        raise ValueError(f"unsupported file type: {ext}")
    sid = "imp-" + uuid.uuid4().hex[:8]
    song = Song(
        id=sid,
        title=PurePath(filename).stem,
        format=fmt,
        isBuiltin=False,
        source="user import",
        license="user-supplied",
        chordpro="",
    )
    REPO.save_import(song, data)
    return song


def get_blob(song_id: str) -> bytes | None:
    from .repo import REPO
    return REPO.get_blob(song_id)


def _chords_from_chordpro(chordpro: str) -> list[str]:
    import re
    return list(dict.fromkeys(re.findall(r"\[([^\]]+)\]", chordpro)))


def delete_song(song_id: str) -> bool:
    from .repo import REPO
    s = get_song(song_id)
    if not s or s.isBuiltin:
        return False
    REPO.delete_import(song_id)
    return True


def update_song(song_id: str, patch: dict) -> Song | None:
    from .repo import REPO
    s = get_song(song_id)
    if not s or s.isBuiltin:
        return None
    if patch.get("title") is not None:
        s.title = patch["title"]
    if patch.get("artist") is not None:
        s.artist = patch["artist"]
    if patch.get("spotifyUri") is not None:
        s.spotifyUri = patch["spotifyUri"] or None
    if patch.get("chordpro") is not None:
        s.chordpro = patch["chordpro"]
        s.chords = _chords_from_chordpro(s.chordpro)
    REPO.update_import(s)
    return s


def import_text(meta: dict, spotify_uri: str | None) -> Song:
    """Store a song from a pasted space-delimited chord sheet + form fields."""
    import uuid
    from . import align
    from .repo import REPO
    sid = "imp-" + uuid.uuid4().hex[:8]
    chordpro = align.parse_spacetext(meta.get("text", ""))
    song = Song(
        id=sid,
        title=meta.get("title") or "Imported song",
        artist=meta.get("artist"),
        key=meta.get("key"),
        tempo=meta.get("bpm"),
        capo=meta.get("capo"),
        chords=_chords_from_chordpro(chordpro),
        format="chordpro",
        isBuiltin=False,
        source="text import",
        license="user-supplied",
        spotifyUri=spotify_uri,
        chordpro=chordpro,
    )
    REPO.save_import(song)
    return song


def import_converted(fields: dict, spotify_uri: str | None) -> Song:
    """Store a ChordPro song produced from a PDF conversion (fields from Groq)."""
    import uuid
    import re
    from .repo import REPO
    sid = "imp-" + uuid.uuid4().hex[:8]
    chordpro = fields.get("chordpro", "")
    # Distinct chords in document order, from the inline [brackets].
    chords = list(dict.fromkeys(re.findall(r"\[([^\]]+)\]", chordpro)))
    capo = fields.get("capo")
    song = Song(
        id=sid,
        title=fields.get("title") or "Imported song",
        artist=fields.get("artist"),
        key=fields.get("key"),
        capo=capo if isinstance(capo, int) else None,
        chords=chords,
        format="chordpro",
        isBuiltin=False,
        source="PDF import",
        license="user-supplied",
        spotifyUri=spotify_uri,
        chordpro=chordpro,
    )
    REPO.save_import(song)
    return song


def list_meta() -> list[SongMeta]:
    return [SongMeta(**s.model_dump(exclude={"chordpro"})) for s in all_songs().values()]


def get_song(song_id: str) -> Song | None:
    return all_songs().get(song_id)
