from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Groq — OpenAI-compatible. Key from env / k8s sealed-secret, never baked in.
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Model IDs are config, not hardcoded (Groq changes them). Verified current.
    coach_model: str = "llama-3.3-70b-versatile"
    fast_model: str = "llama-3.1-8b-instant"
    use_fast_model: bool = False  # dev/cheap iteration

    # Cost guardrails (spec §9/§11) — configurable per-session cap.
    max_tokens_per_session: int = 20000
    max_output_tokens: int = 400  # one coaching turn is short

    # Postgres (CloudNativePG). Empty => in-memory store (local dev fallback).
    database_url: str = ""

    # Spotify Premium play-along (optional, behind a flag). Needs a dev app.
    spotify_enabled: bool = False
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_redirect_uri: str = "http://localhost:8000/api/spotify/callback"

    # Path to the versioned built-in song library (ChordPro .cho files).
    songs_dir: str = "songs"
    # Path to the versioned tutor system prompt.
    prompt_path: str = "prompts/tutor.md"
    # Serve the built React SPA from this dir (prod single-container).
    static_dir: str = "frontend/dist"

    @property
    def model(self) -> str:
        return self.fast_model if self.use_fast_model else self.coach_model

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def db_enabled(self) -> bool:
        return bool(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
