import json
from typing import AsyncIterator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..models import CreateSessionReq, EventsReq, AskReq
from ..repo import REPO
from ..songs import get_song
from ..tutor import stream_coach

router = APIRouter(prefix="/api/session", tags=["session"])


def _sse(gen: AsyncIterator[dict]) -> StreamingResponse:
    async def event_stream():
        async for chunk in gen:
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("")
def create_session(req: CreateSessionReq):
    s = REPO.create_session(req.songId, req.mode)
    return {"id": s.id, "mode": s.mode, "songId": s.song_id}


@router.post("/{sid}/events")
def post_events(sid: str, req: EventsReq):
    # Client posts aggregated PlayEvent summaries (batched), never raw audio.
    if not REPO.get_session(sid):
        raise HTTPException(404, "session not found")
    REPO.set_summary(sid, req.summary)
    return {"ok": True}


@router.get("/{sid}/coach/stream")
def coach_stream(sid: str):
    s = REPO.get_session(sid)
    if not s:
        raise HTTPException(404, "session not found")
    song = get_song(s.song_id) if s.song_id else None
    return _sse(stream_coach(s, song, s.latest_summary))


@router.post("/{sid}/ask")
def ask(sid: str, req: AskReq):
    s = REPO.get_session(sid)
    if not s:
        raise HTTPException(404, "session not found")
    song = get_song(s.song_id) if s.song_id else None
    return _sse(stream_coach(s, song, s.latest_summary, question=req.question))


@router.get("/{sid}")
def get_session(sid: str):
    s = REPO.get_session(sid)
    if not s:
        raise HTTPException(404, "session not found")
    return {
        "id": s.id,
        "songId": s.song_id,
        "mode": s.mode,
        "status": s.status,
        "latestSummary": s.latest_summary.model_dump(by_alias=True) if s.latest_summary else None,
        "tokens": {"input": s.input_tokens, "output": s.output_tokens, "total": s.total_tokens},
        "turns": [{"seq": t.seq, "content": t.content} for t in s.turns],
    }
