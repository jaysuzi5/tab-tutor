from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import get_settings
from .routers import songs, session, spotify

app = FastAPI(title="Tab Tutor")

# Dev: Vite (5173) calls the API (8000). Prod: same origin (FastAPI serves SPA).
app.add_middleware(
    CORSMiddleware,
    # localhost dev + the UG pages (the bookmarklet POSTs the tab JSON from there).
    allow_origins=[
        "http://localhost:5173",
        "https://tabs.ultimate-guitar.com",
        "https://www.ultimate-guitar.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router)
app.include_router(session.router)
app.include_router(spotify.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    s = get_settings()
    return {"status": "ok", "llm": s.llm_enabled, "model": s.model,
            "db": s.db_enabled, "spotify": s.spotify_enabled}


# Serve the built SPA in prod (single container). No-op if dist/ absent (dev).
def _mount_spa() -> None:
    s = get_settings()
    for base in (Path.cwd(), Path(__file__).resolve().parents[2]):
        dist = base / s.static_dir
        if dist.is_dir():
            app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

            @app.get("/{full_path:path}")
            def spa(full_path: str):
                index = dist / "index.html"
                return FileResponse(index)

            return


_mount_spa()
