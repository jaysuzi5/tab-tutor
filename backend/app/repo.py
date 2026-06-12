from .config import get_settings
from .store import MemoryRepo


def _make():
    s = get_settings()
    if s.db_enabled:
        from .persistence import PgRepo
        return PgRepo(s.database_url)
    return MemoryRepo()


# Single repo instance for the process. Postgres when DATABASE_URL is set,
# in-memory otherwise (local dev / tests).
REPO = _make()
