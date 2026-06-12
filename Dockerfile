# --- Stage 1: build the React SPA ---
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# songs/ is imported with ?raw by the frontend (builtin library bundling).
COPY songs/ /songs/
RUN npm run build

# --- Stage 2: FastAPI serving the API + the built SPA ---
FROM python:3.12-slim AS app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend/ ./backend/
COPY songs/ ./songs/
COPY prompts/ ./prompts/
COPY --from=frontend /build/dist ./frontend/dist

# Non-root.
RUN useradd -u 10001 -m appuser && chown -R appuser /app
USER appuser

ENV STATIC_DIR=frontend/dist SONGS_DIR=songs PROMPT_PATH=prompts/tutor.md
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status==200 else 1)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
