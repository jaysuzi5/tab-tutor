import json
from io import BytesIO
from pypdf import PdfReader
from openai import AsyncOpenAI
from .config import get_settings

# PDF -> ChordPro conversion. Extract the raw text, then let Groq turn an
# arbitrary chord sheet (any source/layout) into clean ChordPro + metadata.
# Robust to spacing/columns that a regex parser would choke on.

_SYS = """You convert a guitar chord sheet (raw text extracted from a PDF, often \
with messy spacing) into ChordPro. Chords sit ABOVE the lyric they fall on; place \
them inline as [Chord] immediately before that syllable. Mark sections like \
[Verse]/[Chorus]/[Intro] as {comment: Section}. Keep all lyrics. Preserve any \
standalone tab/riff lines verbatim inside the lyric flow. Do not invent content.

Return ONLY JSON:
{
  "title": string|null,
  "artist": string|null,
  "key": string|null,
  "capo": number|null,
  "chordpro": string   // the full sheet in ChordPro with [Chord] inline
}"""


def extract_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


async def pdf_to_chordpro(pdf_bytes: bytes) -> dict:
    """Returns {title, artist, key, capo, chordpro}. Falls back to raw text."""
    text = extract_text(pdf_bytes).strip()
    if not text:
        raise ValueError("no extractable text in PDF")

    s = get_settings()
    if not s.llm_enabled:
        # No Groq key: store the raw text so the import still works.
        return {"title": None, "artist": None, "key": None, "capo": None,
                "chordpro": text}

    client = AsyncOpenAI(api_key=s.groq_api_key, base_url=s.groq_base_url)
    resp = await client.chat.completions.create(
        model=s.coach_model,
        messages=[
            {"role": "system", "content": _SYS},
            {"role": "user", "content": text[:12000]},  # cap input tokens
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=4000,
    )
    data = json.loads(resp.choices[0].message.content)
    if not data.get("chordpro"):
        data["chordpro"] = text
    return data
