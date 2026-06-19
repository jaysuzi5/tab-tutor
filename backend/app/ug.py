import html
import json
import re
import httpx

# Import a chord sheet from an Ultimate Guitar URL (personal use). The page
# embeds the tab in a `js-store` div whose data-content is HTML-escaped JSON.
# The chord sheet text uses [ch]C[/ch] chord tags and [tab]…[/tab] blocks;
# stripping those tags leaves chords column-aligned above lyrics, which our
# space-text aligner then converts to ChordPro.

_DATA = re.compile(r'data-content="([^"]*)"')
_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _simplify_chord(c: str) -> str:
    m = re.match(r"^([A-G][#b]?)(maj|min|m|sus|add|dim|aug|°|ø|\+)?", c)
    if not m:
        return c
    root, q = m.group(1), m.group(2)
    return root + ("m" if q in ("m", "min") else "")


def clean_content(content: str, simplify: bool = True) -> str:
    return _clean(content, simplify)


def _clean(content: str, simplify: bool) -> str:
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    if simplify:
        content = re.sub(r"\[ch\](.*?)\[/ch\]", lambda m: _simplify_chord(m.group(1)), content)
    else:
        content = content.replace("[ch]", "").replace("[/ch]", "")
    return content.replace("[tab]", "").replace("[/tab]", "")


def parse_store(data: dict, simplify: bool = True) -> dict:
    """Extract title/artist/key/capo + cleaned chord text from a UG js-store
    JSON object (already decoded)."""
    page = data["store"]["page"]["data"]
    tab = page.get("tab", {})
    meta = page.get("tab_view", {}).get("meta", {})
    content = page.get("tab_view", {}).get("wiki_tab", {}).get("content", "")
    if not content:
        raise ValueError("page has no chord content")
    capo = meta.get("capo")
    return {
        "title": tab.get("song_name"),
        "artist": tab.get("artist_name"),
        "key": tab.get("tonality_name") or meta.get("tonality"),
        "capo": int(capo) if isinstance(capo, int) else 0,
        "bpm": meta.get("bpm"),
        "text": _clean(content, simplify),
    }


def import_from_data(raw_json: str, simplify: bool = True) -> dict:
    """Parse the js-store data-content JSON captured client-side (bookmarklet)."""
    return parse_store(json.loads(raw_json), simplify)


async def import_from_url(url: str, simplify: bool = True) -> dict:
    async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                 headers={"User-Agent": _UA}) as client:
        r = await client.get(url)
    if r.status_code != 200:
        raise ValueError(f"could not fetch page (HTTP {r.status_code})")
    m = _DATA.search(r.text)
    if not m:
        raise ValueError("no tab data found on the page")
    return parse_store(json.loads(html.unescape(m.group(1))), simplify)
