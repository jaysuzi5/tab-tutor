# Tab Tutor

> It hears every wrong note. Then it fixes you.

A web app that teaches guitar by **listening to you play** through your mic and
coaching you in real time. Two intelligences, kept cleanly separate:

- **Listening Engine** — browser DSP (Web Audio + pitch/chroma). Decides what
  you actually played. Real-time, client-side, raw audio never leaves the device.
- **Tutor** — Groq LLM. Coaches over *structured summaries* the engine emits.
  Never touches audio.

## Status — Step 3 (of 6)

Runnable end-to-end on `localhost`:

- **Step 1** — ChordPro render, mic calibration, live tuner.
- **Step 2** — open-chord chroma detection (E A D G C Em Am Dm Cadd9),
  PlayEvent stream, scorer → SessionSummary, live chord highlight, chord trainer.
- **Step 3** — FastAPI backend + Groq tutor: SSE coaching grounded in the
  SessionSummary, free-text Q&A, versioned `prompts/tutor.md`, per-session token cap.
- **Step 4** — modes (Learn / Play-through / Drill), tempo slider
  (slow-down-to-learn), Web-Audio metronome + count-in, beat-synced chart cursor,
  real `timingErrMs` (onset vs nearest beat) flowing into the SessionSummary.
- **Step 5** — imports: paste ChordPro, upload Guitar Pro (.gp/.gp5/.gpx) /
  MusicXML → normalized song model, stored + listed alongside built-ins.
  Tab/score files render via **alphaTab** (lazy-loaded) with synth playback +
  beat cursor. Link-out (no scraping). Song picker fetches the backend library.

- **Step 6** — deploy: multi-stage Dockerfile (build SPA → FastAPI serves it),
  Helm chart (`charts/tab-tutor/`: Deployment w/ requests+limits + probes,
  Service, nginx Ingress, CloudNativePG cluster, sealed-secret), ArgoCD
  Application, **Postgres persistence** (sessions + imports survive reload),
  Spotify Premium play-along (OAuth + Web Playback SDK, behind a flag).

**Deploy (homelab, GitOps via ArgoCD):**

```bash
# 1. build + push the image
docker build -t jaysuzi5/tab-tutor:0.1.0 .
docker push jaysuzi5/tab-tutor:0.1.0

# 2. create a DEDICATED Groq key, seal the secret (never commit plaintext)
kubectl create secret generic tab-tutor-secrets -n tab-tutor \
  --from-literal=GROQ_API_KEY='gsk_...' \
  --dry-run=client -o yaml | kubeseal --format yaml \
  > charts/tab-tutor/templates/sealedsecret.yaml

# 3. register the ArgoCD app (auto-syncs charts/tab-tutor)
kubectl apply -f argocd/application.yaml
```

CloudNativePG creates `tab-tutor-db-app` with a ready `uri`; the Deployment
reads it as `DATABASE_URL`. DB creds are NOT in the sealed-secret.

⚠️ **Mic needs HTTPS.** `http://tab-tutor.home` over plain LAN HTTP blocks
`getUserMedia`. Serve via the cloudflared tunnel (real TLS — also fixes the
Spotify redirect URI) or an internal-CA TLS ingress. localhost is exempt (dev).

**Full local stack (Docker):** `docker compose up --build` → http://localhost:8000
(Postgres + app image; set `GROQ_API_KEY` in env for real coaching).

**alphaTab assets:** music font (Bravura) + soundfont load from the jsDelivr
CDN — needs outbound HTTPS (the cloudflared tunnel provides it). For a fully
offline homelab, self-host `dist/font/` + `dist/soundfont/` and point
`AlphaTabView`'s `CDN` const at them.

Tests: `cd frontend && npm test` (chord matcher) · `node test-engine.mjs`
(tempo grid + timeline).

## Dev

Two processes. Backend (needs Python 3.10–3.13; 3.14 lacks pydantic-core wheels):

```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # add GROQ_API_KEY for real coaching (optional)
.venv/bin/python -m uvicorn app.main:app --app-dir . --port 8000
# run from repo root so songs/ + prompts/ resolve, or set SONGS_DIR/PROMPT_PATH
```

Frontend (proxies `/api` → backend):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
# backend on a non-default port? BACKEND_URL=http://localhost:8077 npm run dev
```

Without `GROQ_API_KEY` the tutor runs in **dev mode** (canned, still grounded in
your play data) so the whole app works keyless. Set the key for real Groq
coaching (`llama-3.3-70b-versatile`).

Mic needs a **secure context**. `localhost` works in dev. On the homelab,
`http://tab-tutor.home` over plain LAN HTTP **blocks the mic** — it'll be served
via the cloudflared tunnel (real TLS) so `getUserMedia` works.

## Roadmap notes

- Built-in library is **public-domain / CC only**. Copyrighted songs come via
  user import or link-out — no scraping (see spec §5).
- Spotify Premium position-sync play-along is in MVP scope (behind a config
  flag; needs a Spotify dev app + OAuth).
