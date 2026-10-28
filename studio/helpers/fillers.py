"""Detect Portuguese filler words, stutters and dead air; draft an EDL that removes them.

Reads the word-level transcripts in <edit>/transcripts/ (Scribe shape, from
transcribe.py) and writes:

  <edit>/cortes.md   every removal with timecode, word and reason (review this)
  <edit>/edl.json    a draft EDL for render.py that keeps everything else

It is a first pass, not the final word: read cortes.md, check doubtful cuts
with timeline_view.py, and edit edl.json by hand before rendering. Every cut
edge sits on a word boundary (Hard Rule 6) with 30–200 ms padding (Rule 7).

What it removes:
  - hard fillers, always: hum, hã, ahn, ãh, eh, uh, um...
  - soft fillers (é, tipo, né, então, assim, aí, sabe, bom, olha...) only when
    they stand alone between pauses or are stretched out ("éééé"); with
    --agressivo, also when a pause sits on just one side
  - stutters and repeated words: "eu eu acho" → "eu acho", "a gente a gente"
  - truncated words ending in "-" (false starts, as Scribe marks them)
  - pauses longer than --max-pausa, compressed to the padding around the cut

Usage:
    python studio/helpers/fillers.py <video> [<video> ...] [--edit-dir DIR]
    python studio/helpers/fillers.py bruto.mp4 --agressivo --max-pausa 0.4
    python studio/helpers/fillers.py bruto.mp4 --punch-in 1.08   # disfarça jump cuts
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HARD = {
    "hum", "hm", "hmm", "humm", "hum-hum", "ahn", "ãh", "ã", "ahm", "eh", "éh", "hã", "han",
    "uh", "um", "uhm", "umm", "er", "erm", "mm", "mmm", "mhm", "aham-",
}
SOFT = {
    "é", "tipo", "né", "então", "assim", "aí", "sabe", "bom", "olha", "enfim",
    "cara", "daí", "ah", "ó", "pois", "beleza", "ok", "certo",
}

PAD_BEFORE = 0.05   # before the first kept word of a range
PAD_AFTER = 0.08    # after the last kept word of a range


def norm(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"^[\"'“”«(\[]+|[\"'“”».,!?;:)\]…]+$", "", t)
    return t


def collapse(t: str) -> str:
    """'ééé' → 'é', 'hummm' → 'hum', 'ahnnn' → 'ahn'."""
    return re.sub(r"(.)\1+", r"\1", t) if t not in {"mm", "hmm", "umm"} else t


def is_stretched(raw: str, dur: float) -> bool:
    t = norm(raw)
    return dur >= 0.45 or "..." in raw or "…" in raw or bool(re.search(r"([aeiouéêãâ])\1", t))


def load_words(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    out = []
    for w in data.get("words", []):
        if w.get("type", "word") != "word" or w.get("start") is None or w.get("end") is None:
            continue
        if not (w.get("text") or "").strip():
            continue
        out.append({"text": w["text"].strip(), "start": float(w["start"]), "end": float(w["end"])})
    return out


def classify(words: list[dict], aggressive: bool, min_pause: float) -> list[str | None]:
    """Return, per word, the reason it is cut (None = keep)."""
    n = len(words)
    reasons: list[str | None] = [None] * n

    def gap_before(i: int) -> float:
        return words[i]["start"] - words[i - 1]["end"] if i > 0 else 99.0

    def gap_after(i: int) -> float:
        return words[i + 1]["start"] - words[i]["end"] if i + 1 < n else 99.0

    keys = [collapse(norm(w["text"])) for w in words]

    # Filler clusters: consecutive hard/soft fillers judged together ("é, tipo assim").
    i = 0
    while i < n:
        if keys[i] not in HARD and keys[i] not in SOFT:
            i += 1
            continue
        j = i
        while j + 1 < n and (keys[j + 1] in HARD or keys[j + 1] in SOFT) and gap_after(j) < 0.6:
            j += 1
        cluster = range(i, j + 1)
        has_hard = any(keys[k] in HARD for k in cluster)
        stretched = any(is_stretched(words[k]["text"], words[k]["end"] - words[k]["start"])
                        and keys[k] in SOFT for k in cluster)
        before, after = gap_before(i), gap_after(j)
        isolated = before >= min_pause and after >= min_pause
        one_side = before >= min_pause * 0.6 or after >= min_pause * 0.6
        if has_hard and all(keys[k] in HARD or keys[k] in SOFT for k in cluster) and (
            all(keys[k] in HARD for k in cluster) or isolated or one_side or stretched
        ):
            why = "vício (" + " ".join(words[k]["text"] for k in cluster) + ")"
        elif stretched or isolated or (aggressive and one_side):
            why = "vício" + (" alongado" if stretched else " isolado") + \
                  " (" + " ".join(words[k]["text"] for k in cluster) + ")"
        else:
            why = None
        if why:
            for k in cluster:
                reasons[k] = why
        i = j + 1

    # Truncated words / false starts.
    for k, w in enumerate(words):
        if reasons[k] is None and w["text"].endswith("-"):
            reasons[k] = "palavra truncada"

    # Repeats: "eu eu" and "a gente a gente" (1- and 2-word), keep the last one.
    for size in (2, 1):
        for k in range(n - 2 * size + 1):
            a = [keys[k + m] for m in range(size)]
            b = [keys[k + size + m] for m in range(size)]
            if a != b or any(reasons[k + m] for m in range(2 * size)):
                continue
            if words[k + size]["start"] - words[k + size - 1]["end"] > 0.8:
                continue
            if size == 1 and len(a[0]) <= 1 and a[0] not in {"e", "é", "a", "o"}:
                continue
            for m in range(size):
                reasons[k + m] = "repetição (" + " ".join(words[k + m2]["text"] for m2 in range(size)) + ")"
    return reasons


def build_ranges(words: list[dict], reasons: list[str | None], max_pause: float) -> list[dict]:
    """Keep ranges: runs of kept words, split at every cut word and at long pauses."""
    ranges: list[dict] = []
    cur: list[int] = []

    def close() -> None:
        if not cur:
            return
        first, last = cur[0], cur[-1]
        prev_end = words[first - 1]["end"] if first > 0 else 0.0
        next_start = words[last + 1]["start"] if last + 1 < len(words) else words[last]["end"] + 1.0
        start = max(prev_end, words[first]["start"] - PAD_BEFORE)
        end = min(next_start, words[last]["end"] + PAD_AFTER)
        ranges.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "quote": " ".join(words[k]["text"] for k in cur),
        })
        cur.clear()

    for k in range(len(words)):
        if reasons[k]:
            close()
            continue
        if cur and words[k]["start"] - words[cur[-1]]["end"] > max_pause:
            close()
        cur.append(k)
    close()
    return [r for r in ranges if r["end"] - r["start"] >= 0.12]


def probe_duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def tc(t: float) -> str:
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:05.2f}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Detecta vícios de linguagem e gera edl.json rascunho")
    ap.add_argument("videos", nargs="+", type=Path, help="vídeo(s) brutos, na ordem da montagem")
    ap.add_argument("--edit-dir", type=Path, default=None, help="padrão: <pasta do 1º vídeo>/edit")
    ap.add_argument("--agressivo", action="store_true", help="corta vícios leves com pausa de um lado só")
    ap.add_argument("--min-pausa", type=float, default=0.25,
                    help="pausa (s) que isola um vício leve. Padrão 0.25")
    ap.add_argument("--max-pausa", type=float, default=0.5,
                    help="pausas maiores que isso são encurtadas. Padrão 0.5")
    ap.add_argument("--punch-in", type=float, default=None,
                    help="zoom (ex. 1.08) alternado nos jump cuts para disfarçar o corte")
    ap.add_argument("--grade", default="none", help="preset/filtro de cor para a EDL. Padrão none")
    args = ap.parse_args()

    videos = [v.resolve() for v in args.videos]
    edit_dir = (args.edit_dir or (videos[0].parent / "edit")).resolve()
    tdir = edit_dir / "transcripts"

    sources: dict[str, str] = {}
    all_ranges: list[dict] = []
    report: list[str] = ["# Cortes propostos", ""]
    total_src = 0.0
    zoom_on = False

    for v in videos:
        tr = tdir / f"{v.stem}.json"
        if not tr.exists():
            sys.exit(f"sem transcrição para {v.name}: rode transcribe.py primeiro ({tr})")
        words = load_words(tr)
        reasons = classify(words, args.agressivo, args.min_pausa)
        ranges = build_ranges(words, reasons, args.max_pausa)
        sources[v.stem] = str(v)
        src_dur = probe_duration(v)
        total_src += src_dur

        cut_words = [(w, r) for w, r in zip(words, reasons) if r]
        report.append(f"## {v.stem}  ({tc(src_dur)} bruto, {len(cut_words)} palavras cortadas)")
        report.append("")
        report.append("| tempo | palavra | motivo |")
        report.append("|---|---|---|")
        for w, r in cut_words:
            report.append(f"| {tc(w['start'])} | {w['text']} | {r} |")
        pauses = [(ranges[i]["end"], ranges[i + 1]["start"]) for i in range(len(ranges) - 1)
                  if ranges[i + 1]["start"] - ranges[i]["end"] > args.max_pausa
                  and not any(ranges[i]["end"] <= w["start"] < ranges[i + 1]["start"] for w, _ in cut_words)]
        for a, b in pauses:
            report.append(f"| {tc(a)} | (pausa {b - a:.1f}s) | pausa encurtada |")
        report.append("")

        prev_end = None
        for r in ranges:
            rng = {"source": v.stem, **r}
            # A jump cut is a cut whose two sides are close in the source: same shot, the
            # face jumps. Alternating a gentle punch-in hides it.
            if args.punch_in and prev_end is not None and r["start"] - prev_end < 1.5:
                zoom_on = not zoom_on
            if args.punch_in and zoom_on:
                rng["zoom"] = args.punch_in
            all_ranges.append(rng)
            prev_end = r["end"]

    total_out = sum(r["end"] - r["start"] for r in all_ranges)
    edl = {
        "version": 1,
        "sources": sources,
        "ranges": all_ranges,
        "grade": args.grade,
        "overlays": [],
        "total_duration_s": round(total_out, 2),
    }
    edit_dir.mkdir(parents=True, exist_ok=True)
    (edit_dir / "edl.json").write_text(json.dumps(edl, ensure_ascii=False, indent=2), encoding="utf-8")
    report.insert(2, f"Bruto: {tc(total_src)} → editado: {tc(total_out)} "
                     f"({len(all_ranges)} trechos). Revise antes de renderizar.\n")
    (edit_dir / "cortes.md").write_text("\n".join(report), encoding="utf-8")
    print(f"edl.json + cortes.md → {edit_dir}")
    print(f"  {len(all_ranges)} trechos, bruto {tc(total_src)} → editado {tc(total_out)}")


if __name__ == "__main__":
    main()
