import re
from statistics import median

# Deterministic chord-sheet aligner driven by word coordinates (pymupdf).
# Rows are grouped by Y (PDFs often emit each token as its own block, so block/
# line indices are unreliable). Each row is rendered to a monospace-style string
# using estimated character columns, then a chord row is merged into the lyric
# row below it at exact columns — this handles closely-spaced chords and never
# invents chords or breaks lines.

CHORD_RE = re.compile(
    r"^[A-G][#b]?(?:maj|min|m|dim|aug|sus|add|M|\+|°|ø)*\d*(?:sus\d|add\d)?(?:/[A-G][#b]?)?$"
)
SECTION_RE = re.compile(
    r"(intro|verse|chorus|bridge|outro|pre-?chorus|solo|interlude|tag|refrain|riff|hook|coda)",
    re.I,
)
CAPO_RE = re.compile(r"capo\s*:?\s*(\d{1,2})", re.I)
KEY_RE = re.compile(r"\bkey\s*:?\s*([A-G][#b]?m?)\b", re.I)

X0, Y0, X1, Y1, TEXT = 0, 1, 2, 3, 4


def _col(x: float, left: float, char_w: float) -> int:
    return max(0, round((x - left) / char_w))


def _render(toks, left, char_w) -> str:
    """Lay tokens out at their character columns (monospace approximation)."""
    s = ""
    for x0, _x1, text in toks:
        c = _col(x0, left, char_w)
        if len(s) < c:
            s += " " * (c - len(s))
        elif s and not s.endswith(" "):
            s += " "  # avoid clobbering an overlapping previous token
        s += text
    return s


def _group_rows(words: list) -> list[list[tuple[float, float, str]]]:
    items = [(w[X0], w[X1], w[Y0], w[Y1], w[TEXT]) for w in words if w[TEXT].strip()]
    if not items:
        return []
    h = median([it[3] - it[2] for it in items]) or 10  # glyph height
    tol = h * 0.6
    items.sort(key=lambda it: (it[2], it[0]))  # by y, then x
    rows: list[list] = []
    cur: list = []
    cur_y = None
    for x0, x1, y0, _y1, text in items:
        if cur_y is None or abs(y0 - cur_y) <= tol:
            cur.append((x0, x1, text))
            cur_y = y0 if cur_y is None else (cur_y + y0) / 2
        else:
            rows.append(sorted(cur, key=lambda t: t[0]))
            cur = [(x0, x1, text)]
            cur_y = y0
    if cur:
        rows.append(sorted(cur, key=lambda t: t[0]))
    return rows


def _char_width(words: list) -> float:
    widths = [
        (w[X1] - w[X0]) / len(w[TEXT])
        for w in words
        if w[TEXT].strip() and len(w[TEXT]) >= 2
    ]
    return median(widths) if widths else 6.0


def _is_chord_toks(toks) -> bool:
    if not toks or len(toks) > 16:
        return False
    hits = sum(1 for _, _, t in toks if CHORD_RE.match(t))
    return hits / len(toks) >= 0.6


def _section(text: str) -> str | None:
    t = text.strip().strip("[]")
    if len(t) <= 22 and SECTION_RE.search(t):
        return t
    return None


def _merge(chord_toks, left, char_w, lyric: str) -> str:
    """Insert each chord into the lyric string at the chord's character column."""
    cols = sorted((_col(x0, left, char_w), t) for x0, _x1, t in chord_toks)
    res = ""
    pos = 0
    for col, ch in cols:
        if pos < col:
            if col <= len(lyric):
                res += lyric[pos:col]
                pos = col
            else:
                res += lyric[pos:]
                res += " "  # chord past the end of the lyric
                pos = len(lyric)
        res += f"[{ch}]"
    if pos < len(lyric):
        res += lyric[pos:]
    return res.rstrip()


def align(words: list) -> dict:
    char_w = _char_width(words)
    rows_raw = _group_rows(words)
    left = min((t[0] for r in rows_raw for t in r), default=0.0)
    rows = [[(x0, x1, txt) for x0, x1, txt in r] for r in rows_raw]
    texts = [_render(r, left, char_w) for r in rows]

    out: list[str] = []
    title = artist = key = None
    capo = None
    seen_body = False
    i = 0
    while i < len(rows):
        toks, text = rows[i], texts[i].strip()
        if not text:
            i += 1
            continue

        if capo is None and (m := CAPO_RE.search(text)):
            capo = int(m.group(1))
        if key is None and (m := KEY_RE.search(text)):
            key = m.group(1)
        low = text.lower()
        if low.startswith("capo") or low.startswith("key") or low.startswith("tuning"):
            i += 1
            continue

        sec = _section(text)
        if sec:
            out.append(f"{{comment: {sec}}}")
            seen_body = True
            i += 1
            continue

        if _is_chord_toks(toks):
            nxt = rows[i + 1] if i + 1 < len(rows) else None
            if nxt and not _is_chord_toks(nxt) and not _section(texts[i + 1].strip()):
                out.append(_merge(toks, left, char_w, texts[i + 1]))
                i += 2
            else:
                out.append(" ".join(f"[{t}]" for _, _, t in toks))
                i += 1
            seen_body = True
            continue

        if not seen_body:
            if title is None:
                title = text
                i += 1
                continue
            if artist is None:
                artist = text
                i += 1
                continue
        out.append(text)
        seen_body = True
        i += 1

    return {
        "title": title,
        "artist": artist,
        "key": key,
        "capo": capo,
        "chordpro": "\n".join(out).strip(),
    }


def chord_count(chordpro: str) -> int:
    return len(re.findall(r"\[[^\]]+\]", chordpro))


# --- Plain-text paste parser ------------------------------------------------
# The user pastes a monospace chord sheet (chords on a line above the lyric,
# positioned by spaces). Because the spacing is exact, we align off true
# character columns — no coordinate estimation, no LLM. This is the reliable
# path. Handles [Section] headers and |measure/riff| lines (kept verbatim).

_SECTION_LINE = re.compile(r"^\[.*\]$")


def _is_chord_token(t: str) -> bool:
    return bool(CHORD_RE.match(t.strip("()")))


def _is_chord_text_line(line: str) -> bool:
    if "|" in line:  # measure/rhythm line, not a plain chord line
        return False
    toks = line.split()
    if not toks or len(toks) > 16:
        return False
    hits = sum(1 for t in toks if _is_chord_token(t))
    return hits / len(toks) >= 0.6


def _merge_text(chord_line: str, lyric: str) -> str:
    """Place each chord before the WORD beneath it (chord above the whole word —
    we don't split words mid-letter). Words stay intact so the lyric line keeps
    a single baseline."""
    words = [(m.start(), m.end(), m.group()) for m in re.finditer(r"\S+", lyric)]
    chords = [
        (m.start(), m.group().strip("()"))
        for m in re.finditer(r"\S+", chord_line)
        if _is_chord_token(m.group().strip("()"))
    ]
    if not words:
        return " ".join(f"[{c}]" for _, c in chords)
    pre: dict[int, list[str]] = {}
    for col, ch in chords:
        if col > words[-1][1]:  # chord past the last word -> trailing
            pre.setdefault(len(words), []).append(ch)
            continue
        best, bestd = 0, None
        for idx, (s, e, _) in enumerate(words):
            d = 0 if s <= col <= e else min(abs(col - s), abs(col - e))
            if bestd is None or d < bestd:
                bestd, best = d, idx
        pre.setdefault(best, []).append(ch)
    # Attach a single chord directly to its word ([G]word) so it renders ABOVE
    # the word. When several chords land on one word, space-separate them so each
    # gets its own slot above the lyrics (e.g. [D] [C]word) — and so the earlier
    # ones sit on the chord row instead of dropping below.
    def fmt(chs: list[str], word: str) -> str:
        if not chs:
            return word
        if len(chs) == 1:
            return f"[{chs[0]}]{word}"
        return " ".join(f"[{c}]" for c in chs[:-1]) + " " + f"[{chs[-1]}]{word}"

    parts = [fmt(pre.get(idx, []), w) for idx, (_s, _e, w) in enumerate(words)]
    line = " ".join(parts)
    trailing = " ".join(f"[{c}]" for c in pre.get(len(words), []))
    return (line + (" " + trailing if trailing else "")).strip()


def parse_spacetext(raw: str) -> str:
    lines = raw.replace("\t", "    ").split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if _SECTION_LINE.match(stripped):
            out.append(f"{{comment: {stripped.strip('[]')}}}")
            i += 1
            continue
        if "|" in line:  # measure / riff line -> keep verbatim
            out.append(stripped)
            i += 1
            continue
        if _is_chord_text_line(line):
            nxt = lines[i + 1] if i + 1 < len(lines) else None
            lyric_ok = (
                nxt is not None
                and nxt.strip()
                and "|" not in nxt
                and not _SECTION_LINE.match(nxt.strip())
                and not _is_chord_text_line(nxt)
            )
            if lyric_ok:
                out.append(_merge_text(line, nxt))
                i += 2
            else:
                out.append(" ".join(
                    f"[{t.strip('()')}]" for t in line.split() if _is_chord_token(t)
                ))
                i += 1
            continue
        out.append(stripped)
        i += 1
    return "\n".join(out).strip()
