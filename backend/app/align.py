import re

# Deterministic chord-sheet aligner. Chord sheets put chords on a line ABOVE the
# lyric, positioned horizontally over the syllable where the change happens. We
# use each word's x-coordinate (from pymupdf) to place [chords] over the lyric
# word beneath them — exact placement, exactly one bracket per chord token, no
# LLM guessing (which clumped chords and invented extras).

# A chord token: root + optional quality/extensions + optional slash bass.
CHORD_RE = re.compile(
    r"^[A-G][#b]?(?:maj|min|m|dim|aug|sus|add|M|\+|°|ø)*\d*(?:sus\d|add\d)?(?:/[A-G][#b]?)?$"
)
SECTION_RE = re.compile(
    r"(intro|verse|chorus|bridge|outro|pre-?chorus|solo|interlude|tag|refrain|riff|hook|coda)",
    re.I,
)
CAPO_RE = re.compile(r"capo\s*:?\s*(\d{1,2})", re.I)
KEY_RE = re.compile(r"\bkey\s*:?\s*([A-G][#b]?m?)\b", re.I)

# pymupdf get_text("words") tuple indices.
X0, Y0, TEXT, BLOCK, LINE = 0, 1, 4, 5, 6


def _lines(words: list) -> list[list[tuple[float, str]]]:
    """Group words into visual lines (by block+line), ordered top→bottom."""
    groups: dict[tuple, list] = {}
    for w in words:
        groups.setdefault((w[BLOCK], w[LINE]), []).append(w)
    lines = []
    for ws in groups.values():
        ws.sort(key=lambda w: w[X0])
        y = min(w[Y0] for w in ws)
        lines.append((y, [(w[X0], w[TEXT]) for w in ws if w[TEXT].strip()]))
    lines.sort(key=lambda t: t[0])
    return [toks for _, toks in lines if toks]


def _is_chord_line(toks: list[tuple[float, str]]) -> bool:
    if not toks or len(toks) > 14:
        return False
    hits = sum(1 for _, t in toks if CHORD_RE.match(t))
    return hits / len(toks) >= 0.6


def _is_section(toks: list[tuple[float, str]]) -> str | None:
    text = " ".join(t for _, t in toks).strip(" []")
    if len(toks) <= 5 and SECTION_RE.search(text):
        return text
    return None


def _merge(chords: list[tuple[float, str]], lyrics: list[tuple[float, str]]) -> str:
    """Put each chord before the lyric word whose x is nearest the chord's x."""
    if not lyrics:
        return " ".join(f"[{c}]" for _, c in chords)
    prefix: dict[int, list[str]] = {}
    for cx, c in chords:
        best, bestd = 0, float("inf")
        for i, (lx, _) in enumerate(lyrics):
            d = abs(lx - cx)
            if d < bestd:
                bestd, best = d, i
        # chord sitting past the last word -> attach to end of line
        if cx > lyrics[-1][0] + 8:
            best = len(lyrics)
        prefix.setdefault(best, []).append(c)
    out = []
    for i, (_, word) in enumerate(lyrics):
        for c in prefix.get(i, []):
            out.append(f"[{c}]")
        out.append(word)
    for c in prefix.get(len(lyrics), []):
        out.append(f"[{c}]")
    return " ".join(out)


def align(words: list) -> dict:
    lines = _lines(words)
    out: list[str] = []
    title = artist = key = None
    capo = None
    seen_body = False
    i = 0
    while i < len(lines):
        toks = lines[i]
        text = " ".join(t for _, t in toks).strip()

        if capo is None and (m := CAPO_RE.search(text)):
            capo = int(m.group(1))
        if key is None and (m := KEY_RE.search(text)):
            key = m.group(1)
        # Drop standalone capo/key/tuning directive lines from the body (already
        # captured as metadata).
        low = text.lower()
        if low[:4] in ("capo", "key:", "key ", "tuni") or low.startswith("key"):
            i += 1
            continue

        section = _is_section(toks)
        if section:
            out.append(f"{{comment: {section}}}")
            seen_body = True
            i += 1
            continue

        if _is_chord_line(toks):
            nxt = lines[i + 1] if i + 1 < len(lines) else None
            if nxt and not _is_chord_line(nxt) and not _is_section(nxt):
                out.append(_merge(toks, nxt))
                i += 2
            else:
                out.append(" ".join(f"[{c}]" for _, c in toks))
                i += 1
            seen_body = True
            continue

        # Plain text line. Before the body starts, treat the first couple of
        # lines as title / artist metadata.
        if not seen_body and text:
            if title is None and not CAPO_RE.search(text) and not KEY_RE.search(text):
                title = text
                i += 1
                continue
            if artist is None and not CAPO_RE.search(text) and not KEY_RE.search(text):
                artist = text
                i += 1
                continue
        if text:
            out.append(text)
            seen_body = True
        i += 1

    chordpro = "\n".join(out).strip()
    return {"title": title, "artist": artist, "key": key, "capo": capo, "chordpro": chordpro}


def chord_count(chordpro: str) -> int:
    return len(re.findall(r"\[[^\]]+\]", chordpro))
