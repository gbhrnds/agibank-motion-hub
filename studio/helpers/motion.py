"""Cria e renderiza slots de motion graphics HyperFrames com a marca Agibank.

Cada animação vive no seu próprio slot: <edit>/animations/slot_<id>/. O slot é
um projeto HyperFrames completo (index.html + assets/ com fontes, logos e
brand.css), então dá para abrir no Studio (`npx hyperframes preview`) e editar.

Templates em studio/motion/templates/:
    lower-third   nome + cargo, fundo transparente (overlay sobre o vídeo)
    destaque      palavra-chave / número em destaque, transparente
    titulo        cartela de abertura/capítulo em tela cheia (opaca)
    encerramento  assinatura final com logo e CTA (opaca)

Uso:
    python studio/helpers/motion.py list
    python studio/helpers/motion.py new lower-third <edit>/animations/slot_01 \
        --duration 5 --orient landscape --var nome="Ana Souza" --var cargo="Analista de Dados"
    python studio/helpers/motion.py render <edit>/animations/slot_01            # webm com alfa
    python studio/helpers/motion.py render <edit>/animations/slot_01 --format mp4
    python studio/helpers/motion.py assets <edit>/animations/slot_01   # recopia fontes/logos/GSAP

`render` roda `hyperframes lint` + `check` antes de renderizar e verifica a
duração do arquivo final com ffprobe.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
REPO = STUDIO.parent
TEMPLATES = STUDIO / "motion" / "templates"
BRAND_CSS = STUDIO / "motion" / "brand" / "brand.css"
GSAP = STUDIO / "motion" / "node_modules" / "gsap" / "dist" / "gsap.min.js"
HYPERFRAMES = ["npx", "--yes", "hyperframes@0.8.212"]

SIZES = {
    "landscape": (1920, 1080),
    "portrait": (1080, 1920),
    "square": (1080, 1080),
}

# Templates opacos (tela cheia) não precisam de canal alfa.
OPAQUE = {"titulo", "encerramento"}


def list_templates() -> list[str]:
    return sorted(p.name for p in TEMPLATES.iterdir() if (p / "index.html").exists())


def parse_vars(items: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in items:
        if "=" not in item:
            sys.exit(f"--var precisa ser chave=valor, recebi: {item}")
        k, v = item.split("=", 1)
        out[k.strip()] = v
    return out


def ensure_gsap() -> None:
    """GSAP vem do npm (studio/motion/package.json): o render não pode buscar CDN."""
    if not GSAP.exists():
        subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=STUDIO / "motion", check=True)


def copy_brand_assets(slot: Path) -> None:
    ensure_gsap()
    assets = slot / "assets"
    (assets / "fonts").mkdir(parents=True, exist_ok=True)
    (assets / "logos").mkdir(parents=True, exist_ok=True)
    shutil.copy2(BRAND_CSS, assets / "brand.css")
    shutil.copy2(GSAP, assets / "gsap.min.js")
    for weight in ["Light", "Regular", "Medium", "SemiBold", "Bold", "ExtraBold", "Black"]:
        src = REPO / "assets" / "fonts" / f"AgibankSans-{weight}.woff2"
        shutil.copy2(src, assets / "fonts" / src.name)
    for logo in (REPO / "assets" / "logos").glob("*.svg"):
        shutil.copy2(logo, assets / "logos" / logo.name)


def fill_template(text: str, values: dict[str, str], w: int, h: int, dur: float, orient: str) -> str:
    text = (
        text.replace("__W__", str(w))
        .replace("__H__", str(h))
        .replace("__DUR__", f"{dur:g}")
        .replace("__ORIENT__", orient)
    )

    # Defaults dos placeholders vêm da declaração de variáveis do próprio template.
    m = re.search(r"data-composition-variables='([^']*)'", text)
    declared = json.loads(html.unescape(m.group(1))) if m else []
    ids = [v["id"] for v in declared]
    unknown = set(values) - set(ids)
    if unknown:
        sys.exit(f"variáveis desconhecidas para este template: {sorted(unknown)} (aceitas: {ids})")
    missing = [i for i in ids if i not in values]
    if missing:
        sys.exit(f"faltam variáveis: {missing} (passe --var {missing[0]}=...)")

    if m:
        for v in declared:
            v["default"] = values[v["id"]]
        attr = html.escape(json.dumps(declared, ensure_ascii=False), quote=True)
        text = text.replace(m.group(0), f"data-composition-variables='{attr}'")
    for k, v in values.items():
        text = text.replace("{{" + k + "}}", html.escape(v))
    return text


def cmd_new(args: argparse.Namespace) -> None:
    tpl_dir = TEMPLATES / args.template
    if not (tpl_dir / "index.html").exists():
        sys.exit(f"template '{args.template}' não existe. Disponíveis: {', '.join(list_templates())}")
    slot = args.slot.resolve()
    if (slot / "index.html").exists() and not args.force:
        sys.exit(f"{slot} já tem index.html (use --force para sobrescrever)")
    slot.mkdir(parents=True, exist_ok=True)

    w, h = SIZES[args.orient]
    values = parse_vars(args.var)
    text = fill_template((tpl_dir / "index.html").read_text(encoding="utf-8"), values, w, h, args.duration, args.orient)
    (slot / "index.html").write_text(text, encoding="utf-8")
    copy_brand_assets(slot)
    (slot / "slot.json").write_text(json.dumps({
        "template": args.template,
        "orient": args.orient,
        "width": w,
        "height": h,
        "duration": args.duration,
        "vars": values,
        "alpha": args.template not in OPAQUE,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"slot criado: {slot}  ({args.template}, {w}x{h}, {args.duration:g}s)")
    print(f"  edite {slot / 'index.html'} se precisar; depois: motion.py render {slot}")


def run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def cmd_render(args: argparse.Namespace) -> None:
    slot = args.slot.resolve()
    meta_path = slot / "slot.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    fmt = args.format or ("webm" if meta.get("alpha", True) else "mp4")

    lint = run([*HYPERFRAMES, "lint"], slot)
    print(lint.stdout[-2000:], lint.stderr[-1000:])
    if lint.returncode != 0:
        sys.exit("lint falhou — corrija o index.html antes de renderizar")
    if not args.skip_check:
        check = run([*HYPERFRAMES, "check", "--json"], slot)
        if check.returncode != 0:
            print(check.stdout[-4000:], check.stderr[-2000:])
            sys.exit("check falhou — corrija os erros acima (ou --skip-check se for falso positivo)")

    out = slot / f"render.{fmt}"
    render = run([*HYPERFRAMES, "render", "--format", fmt, "--quality", args.quality, "--output", str(out)], slot)
    if render.returncode != 0 or not out.exists():
        print(render.stdout[-4000:], render.stderr[-4000:])
        sys.exit("render falhou")
    dur = probe_duration(out)
    expected = meta.get("duration")
    print(f"render: {out}  ({dur:.2f}s{'' if expected is None else f', esperado {expected:g}s'})")
    if expected is not None and abs(dur - float(expected)) > 0.15:
        sys.exit("duração do render não bate com o slot — confira o data-duration")


def main() -> None:
    ap = argparse.ArgumentParser(description="Motion graphics Agibank via HyperFrames")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="lista os templates")

    n = sub.add_parser("new", help="cria um slot a partir de um template")
    n.add_argument("template")
    n.add_argument("slot", type=Path)
    n.add_argument("--duration", type=float, default=5.0)
    n.add_argument("--orient", choices=sorted(SIZES), default="landscape")
    n.add_argument("--var", action="append", default=[], help="chave=valor (repita)")
    n.add_argument("--force", action="store_true")

    r = sub.add_parser("render", help="lint + check + render do slot")
    r.add_argument("slot", type=Path)
    r.add_argument("--format", choices=["webm", "mov", "mp4"], default=None,
                   help="padrão: webm (alfa) para overlays, mp4 para cartelas opacas")
    r.add_argument("--quality", choices=["draft", "looks", "delivery"], default="looks")
    r.add_argument("--skip-check", action="store_true")

    a = sub.add_parser("assets", help="recopia fontes, logos, brand.css e GSAP para o slot")
    a.add_argument("slot", type=Path)

    args = ap.parse_args()
    if args.cmd == "list":
        print("\n".join(list_templates()))
    elif args.cmd == "assets":
        copy_brand_assets(args.slot.resolve())
        print(f"assets atualizados em {args.slot / 'assets'}")
    elif args.cmd == "new":
        cmd_new(args)
    else:
        cmd_render(args)


if __name__ == "__main__":
    main()
