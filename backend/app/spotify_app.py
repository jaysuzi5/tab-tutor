import base64
import time
import httpx
from .config import get_settings

# App-level Spotify access via the Client Credentials flow (no user). Used to
# resolve a track URI for an imported song at import time. Separate from the
# per-user OAuth tokens used for playback.

_token: str | None = None
_expires_at = 0.0


async def _app_token() -> str | None:
    global _token, _expires_at
    s = get_settings()
    if not (s.spotify_client_id and s.spotify_client_secret):
        return None
    if _token and time.time() < _expires_at - 30:
        return _token
    basic = base64.b64encode(
        f"{s.spotify_client_id}:{s.spotify_client_secret}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={"Authorization": f"Basic {basic}",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
    if r.status_code != 200:
        return None
    j = r.json()
    _token = j["access_token"]
    _expires_at = time.time() + j.get("expires_in", 3600)
    return _token


async def find_tracks(query: str, limit: int = 5) -> list[dict]:
    """Top tracks for a query -> [{uri, name, artists, album}]."""
    token = await _app_token()
    if not token:
        return []
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.spotify.com/v1/search",
            params={"q": query, "type": "track", "limit": limit},
            headers={"Authorization": f"Bearer {token}"},
        )
    if r.status_code != 200:
        return []
    return [
        {
            "uri": t["uri"],
            "name": t["name"],
            "artists": ", ".join(a["name"] for a in t["artists"]),
            "album": t.get("album", {}).get("name", ""),
        }
        for t in r.json().get("tracks", {}).get("items", [])
    ]


async def find_track(query: str) -> dict | None:
    """Best single match for a 'title artist' query."""
    tracks = await find_tracks(query, 1)
    return tracks[0] if tracks else None
