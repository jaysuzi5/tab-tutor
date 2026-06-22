import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from ..models import Song, SongMeta, ImportChordProReq, ImportTextReq, ImportUrlReq, PatchSongReq
from .. import songs

router = APIRouter(prefix="/api/songs", tags=["songs"])

# Max upload size for a tab/score file (Guitar Pro / MusicXML are small).
_MAX_UPLOAD = 5 * 1024 * 1024


@router.get("", response_model=list[SongMeta])
def list_songs():
    return songs.list_meta()


@router.post("/import/chordpro", response_model=Song)
def import_chordpro(req: ImportChordProReq):
    if not req.text.strip():
        raise HTTPException(400, "empty chordpro")
    return songs.import_chordpro(req.text, req.title)


@router.post("/import/text", response_model=Song)
async def import_text(req: ImportTextReq):
    if not req.text.strip():
        raise HTTPException(400, "empty chord text")
    from ..spotify_app import find_track
    spotify_uri = None
    track = await find_track(f"{req.title} {req.artist or ''}".strip())
    if track:
        spotify_uri = track["uri"]
    return songs.import_text(req.model_dump(), spotify_uri)


@router.post("/import/url", response_model=Song)
async def import_url(req: ImportUrlReq):
    from ..ug import import_from_url
    from ..spotify_app import find_track
    try:
        meta = await import_from_url(req.url, req.simplify)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        raise HTTPException(502, "could not fetch or parse the page")
    if not meta.get("text", "").strip():
        raise HTTPException(422, "no chords found on the page")
    spotify_uri = None
    if meta.get("title"):
        track = await find_track(f"{meta['title']} {meta.get('artist') or ''}".strip())
        if track:
            spotify_uri = track["uri"]
    return songs.import_text(meta, spotify_uri)


@router.post("/import/ug-data", response_model=Song)
async def import_ug_data(request: Request):
    # Body is the JSON captured by the UG bookmarklet, sent as text/plain to
    # avoid a CORS preflight. {title, artist, key, capo, content, simplify}.
    import json as _json
    from ..ug import clean_content, convert_strummings
    from ..spotify_app import find_track
    raw = (await request.body()).decode("utf-8", "replace")
    try:
        p = _json.loads(raw)
    except Exception:
        raise HTTPException(400, "invalid payload")
    content = clean_content(p.get("content", ""), bool(p.get("simplify", True)))
    if not content.strip():
        raise HTTPException(422, "no chord content")
    capo = p.get("capo")
    if isinstance(capo, str):
        mm = re.search(r"\d+", capo)
        capo = int(mm.group()) if mm else 0
    meta = {
        "title": p.get("title"), "artist": p.get("artist"), "key": p.get("key"),
        "capo": capo or 0, "bpm": p.get("bpm"), "text": content,
        "strumming": convert_strummings(p.get("strummings")),
    }
    uri = None
    if meta["title"]:
        t = await find_track(f"{meta['title']} {meta.get('artist') or ''}".strip())
        if t:
            uri = t["uri"]
    return songs.import_text(meta, uri)


@router.post("/import/file", response_model=Song)
async def import_file(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(413, "file too large")
    try:
        return songs.import_file(file.filename or "upload", data)
    except ValueError as e:
        raise HTTPException(415, str(e))


@router.post("/import/pdf", response_model=Song)
async def import_pdf(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(413, "file too large")
    from ..convert import pdf_to_chordpro
    from ..spotify_app import find_track
    try:
        fields = await pdf_to_chordpro(data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        raise HTTPException(502, "conversion failed")
    # Best-effort Spotify match for play-along (non-fatal if it misses).
    spotify_uri = None
    title, artist = fields.get("title"), fields.get("artist")
    if title:
        track = await find_track(f"{title} {artist or ''}".strip())
        if track:
            spotify_uri = track["uri"]
    return songs.import_converted(fields, spotify_uri)


@router.get("/{song_id}/file")
def get_song_file(song_id: str):
    blob = songs.get_blob(song_id)
    if blob is None:
        raise HTTPException(404, "no file for this song")
    # alphaTab sniffs the format from the bytes; octet-stream is fine.
    return Response(blob, media_type="application/octet-stream")


@router.get("/{song_id}", response_model=Song)
def get_song(song_id: str):
    s = songs.get_song(song_id)
    if not s:
        raise HTTPException(404, "song not found")
    return s


@router.patch("/{song_id}", response_model=Song)
def edit_song(song_id: str, req: PatchSongReq):
    existing = songs.get_song(song_id)
    if not existing:
        raise HTTPException(404, "song not found")
    if existing.isBuiltin:
        raise HTTPException(403, "built-in songs can't be edited")
    return songs.update_song(song_id, req.model_dump(exclude_unset=True))


@router.delete("/{song_id}")
def delete_song(song_id: str):
    existing = songs.get_song(song_id)
    if not existing:
        raise HTTPException(404, "song not found")
    if existing.isBuiltin:
        raise HTTPException(403, "built-in songs can't be deleted")
    songs.delete_song(song_id)
    return {"ok": True}
