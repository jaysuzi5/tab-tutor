import base64
import json
import fitz  # pymupdf
from openai import AsyncOpenAI
from .config import get_settings
from . import align

# PDF -> ChordPro conversion. Prefer the text layer; if the PDF has none
# (scanned / outlined-font chord sheets, the common case), render the pages and
# read them with a Groq vision model. Robust to arbitrary sources/layouts.

_INSTRUCTION = """Convert this guitar chord sheet into ChordPro. Chords sit \
ABOVE the lyric they fall on; place them inline as [Chord] immediately before \
that syllable. Mark sections like [Verse]/[Chorus]/[Intro] as {comment: Section}. \
Keep all lyrics. Preserve any standalone tab/riff lines verbatim. Do not invent content.

Return ONLY JSON:
{"title": string|null, "artist": string|null, "key": string|null,
 "capo": number|null, "chordpro": string}"""

_MIN_TEXT = 40  # below this we assume there's no real text layer
_MAX_PAGES = 4


def _client() -> AsyncOpenAI:
    s = get_settings()
    return AsyncOpenAI(api_key=s.groq_api_key, base_url=s.groq_base_url)


def _open(pdf_bytes: bytes) -> "fitz.Document":
    return fitz.open(stream=pdf_bytes, filetype="pdf")


def extract_text(doc: "fitz.Document") -> str:
    return "\n".join(page.get_text() for page in doc).strip()


def render_pages(doc: "fitz.Document") -> list[str]:
    """Render up to _MAX_PAGES to base64 JPEG data URIs (kept small for Groq)."""
    out: list[str] = []
    mat = fitz.Matrix(2.0, 2.0)  # ~144 dpi
    for page in list(doc)[:_MAX_PAGES]:
        pix = page.get_pixmap(matrix=mat)
        jpg = pix.tobytes("jpeg", jpg_quality=70)
        out.append("data:image/jpeg;base64," + base64.b64encode(jpg).decode())
    return out


def _normalize(data: dict, fallback: str) -> dict:
    if not data.get("chordpro"):
        data["chordpro"] = fallback
    return data


async def _from_text(text: str) -> dict:
    s = get_settings()
    resp = await _client().chat.completions.create(
        model=s.coach_model,
        messages=[
            {"role": "system", "content": _INSTRUCTION},
            {"role": "user", "content": text[:12000]},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=4000,
    )
    return _normalize(json.loads(resp.choices[0].message.content), text)


async def _from_images(images: list[str]) -> dict:
    s = get_settings()
    content = [{"type": "text", "text": _INSTRUCTION}]
    content += [{"type": "image_url", "image_url": {"url": u}} for u in images]
    resp = await _client().chat.completions.create(
        model=s.vision_model,
        messages=[{"role": "user", "content": content}],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=4000,
    )
    return _normalize(json.loads(resp.choices[0].message.content), "")


async def pdf_to_chordpro(pdf_bytes: bytes) -> dict:
    """Returns {title, artist, key, capo, chordpro}."""
    doc = _open(pdf_bytes)
    try:
        text = extract_text(doc)

        # Text-layer PDF: align deterministically from word coordinates. This is
        # the accurate path (exact chord placement, no invented chords).
        if len(text) >= _MIN_TEXT:
            words = []
            for page in doc:
                words.extend(page.get_text("words"))
            result = align.align(words)
            if align.chord_count(result["chordpro"]) >= 2:
                return result
            # Aligner found ~no chords (odd layout) -> let the LLM try the text.
            s = get_settings()
            return await _from_text(text) if s.llm_enabled else result

        # No usable text layer -> image PDF: read rendered pages with vision.
        s = get_settings()
        if not s.llm_enabled:
            raise ValueError("no extractable text in PDF (and no Groq key for vision)")
        images = render_pages(doc)
        if not images:
            raise ValueError("PDF has no pages")
        return await _from_images(images)
    finally:
        doc.close()
