import base64
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from ..config import get_settings

# Optional Spotify Premium play-along (spec §6). Server holds the client secret
# and does the code<->token exchange; the Web Playback SDK runs client-side with
# the returned access token. Premium-only, behind the spotify_enabled flag.
# Position-sync of the chart to the track (tap-tempo / markers) is a later step.

router = APIRouter(prefix="/api/spotify", tags=["spotify"])

_AUTH = "https://accounts.spotify.com/authorize"
_TOKEN = "https://accounts.spotify.com/api/token"
_SCOPES = "streaming user-read-email user-read-private"


def _guard():
    s = get_settings()
    if not s.spotify_enabled:
        raise HTTPException(503, "Spotify is disabled")
    if not (s.spotify_client_id and s.spotify_client_secret):
        raise HTTPException(503, "Spotify is not configured")
    return s


@router.get("/status")
def status():
    s = get_settings()
    return {"enabled": s.spotify_enabled,
            "configured": bool(s.spotify_client_id and s.spotify_client_secret)}


@router.get("/login")
def login():
    s = _guard()
    params = {
        "response_type": "code",
        "client_id": s.spotify_client_id,
        "scope": _SCOPES,
        "redirect_uri": s.spotify_redirect_uri,
    }
    return RedirectResponse(f"{_AUTH}?{urlencode(params)}")


@router.get("/callback")
async def callback(code: str | None = None, error: str | None = None):
    s = _guard()
    if error or not code:
        return RedirectResponse("/?spotify_error=" + (error or "no_code"))
    basic = base64.b64encode(
        f"{s.spotify_client_id}:{s.spotify_client_secret}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            _TOKEN,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": s.spotify_redirect_uri,
            },
            headers={"Authorization": f"Basic {basic}",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
    if r.status_code != 200:
        return RedirectResponse("/?spotify_error=token_exchange")
    tok = r.json()
    # Hand the access token to the SPA (Web Playback SDK needs it client-side).
    return RedirectResponse(
        f"/?spotify_token={tok['access_token']}&expires_in={tok.get('expires_in', 3600)}"
    )
