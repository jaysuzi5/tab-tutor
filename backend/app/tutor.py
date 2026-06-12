import json
from pathlib import Path
from typing import AsyncIterator
from openai import AsyncOpenAI
from .config import get_settings
from .models import Song, SessionSummary
from .store import Session

# The tutor: builds a tight prompt from the structured summary (never audio),
# streams a short coaching turn from Groq, and reports token usage so the
# per-session cap can be enforced. Falls back to a canned stream when no API key
# is set, so the whole app runs end-to-end in dev without a key.

_PROMPT_CACHE: str | None = None


def system_prompt() -> str:
    global _PROMPT_CACHE
    if _PROMPT_CACHE is None:
        s = get_settings()
        for base in (Path.cwd(), Path(__file__).resolve().parents[2]):
            p = base / s.prompt_path
            if p.is_file():
                _PROMPT_CACHE = p.read_text(encoding="utf-8")
                break
        else:
            _PROMPT_CACHE = "You are Tab Tutor, an encouraging beginner guitar teacher."
    return _PROMPT_CACHE


def _client() -> AsyncOpenAI:
    s = get_settings()
    return AsyncOpenAI(api_key=s.groq_api_key, base_url=s.groq_base_url)


def _song_context(song: Song | None) -> str:
    if not song:
        return "No song selected."
    return (
        f"Song: {song.title} ({song.artist or 'trad'}), key {song.key}, "
        f"{song.tempo or '?'} bpm, chords {' '.join(song.chords)}, "
        f"difficulty {song.difficulty or 'beginner'}."
    )


def _summary_context(summary: SessionSummary | None) -> str:
    if not summary:
        return "No play data yet — greet them and invite them to start."
    return "SessionSummary (the measured play data):\n" + json.dumps(
        summary.model_dump(by_alias=True), separators=(",", ":")
    )


def build_messages(
    session: Session, song: Song | None, summary: SessionSummary | None,
    user_question: str | None,
) -> list[dict]:
    msgs: list[dict] = [{"role": "system", "content": system_prompt()}]
    msgs.append({"role": "system", "content": _song_context(song)})
    msgs.append({"role": "system", "content": _summary_context(summary)})
    # Short recent history keeps context tight + cheap.
    for turn in session.turns[-3:]:
        msgs.append({"role": "assistant", "content": turn.content})
    if user_question:
        msgs.append({"role": "user", "content": user_question})
    else:
        msgs.append({"role": "user", "content": "Coach me on what you just measured."})
    return msgs


async def _canned(summary: SessionSummary | None, question: str | None) -> AsyncIterator[str]:
    # Dev fallback (no GROQ_API_KEY). Grounded enough to demo the pipeline.
    if question:
        text = f"(dev mode — no Groq key) Good question: \"{question}\". Set GROQ_API_KEY for real coaching."
    elif summary and summary.recurringMisses:
        m = summary.recurringMisses[0]
        text = (f"Nice work — {summary.cleanRunPct}% clean. That {m.from_}→{m.to} "
                f"change tripped you {m.count}x. Let's loop just that. (dev mode)")
    else:
        text = "Mic's on and I'm listening — strum a chord and I'll follow along. (dev mode — set GROQ_API_KEY)"
    for word in text.split(" "):
        yield word + " "


async def stream_coach(
    session: Session, song: Song | None, summary: SessionSummary | None,
    question: str | None = None,
) -> AsyncIterator[dict]:
    """Yields {'delta': str} chunks, then a final {'done': True, 'usage': {...}}."""
    s = get_settings()

    # Cost guardrail: hard cap per session (spec §9/§11).
    if session.total_tokens >= s.max_tokens_per_session:
        yield {"delta": "We've practiced a lot this session — take a breather and start a fresh one to keep going."}
        yield {"done": True, "usage": {"input": 0, "output": 0}, "capped": True}
        return

    parts: list[str] = []
    in_tok = out_tok = 0

    if not s.llm_enabled:
        async for delta in _canned(summary, question):
            parts.append(delta)
            yield {"delta": delta}
    else:
        messages = build_messages(session, song, summary, question)
        try:
            stream = await _client().chat.completions.create(
                model=s.model,
                messages=messages,
                stream=True,
                max_tokens=s.max_output_tokens,
                temperature=0.6,
                stream_options={"include_usage": True},
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    d = chunk.choices[0].delta.content
                    parts.append(d)
                    yield {"delta": d}
                if chunk.usage:
                    in_tok = chunk.usage.prompt_tokens
                    out_tok = chunk.usage.completion_tokens
        except Exception as e:  # rate limit / overload / stream drop (spec §9)
            yield {"delta": " …one sec — let me catch my breath."}
            yield {"done": True, "usage": {"input": in_tok, "output": out_tok}, "error": str(e)[:120]}
            if parts:
                session_add(session, "".join(parts), in_tok, out_tok)
            return

    content = "".join(parts).strip()
    session_add(session, content, in_tok, out_tok)
    yield {"done": True, "usage": {"input": in_tok, "output": out_tok},
           "totalTokens": session.total_tokens}


def session_add(session: Session, content: str, in_tok: int, out_tok: int) -> None:
    from .repo import REPO
    REPO.add_turn(session.id, content, in_tok, out_tok)
    # Keep the in-memory object consistent for the rest of this request.
    session.input_tokens += in_tok
    session.output_tokens += out_tok
