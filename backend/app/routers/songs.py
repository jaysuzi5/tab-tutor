from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from ..models import Song, SongMeta, ImportChordProReq, PatchSongReq
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
