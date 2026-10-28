# Vídeo Telão Campus — O jeito Agi | Reconhecimentos 2026.2

Motion 16:9 (1920×1080, 24fps, 53s) feito 100% em código (Canvas 2D determinístico).

| Tempo | Cena |
|---|---|
| 0–12s | **01 · Abertura e meritocracia** — fundo `#f3f3f3`, cacos amarelos, logo da campanha, foto 1 mascarada em caco (Ativo 37) e lettering |
| 12–38s | **02 · Números de reconhecimento** — transição rápida por caco para `#0064f5`, poucos cacos amarelos grandes nas extremidades + contornos brancos, header "Reconhecimentos 2026.2", 4 tópicos em destaque (4s cada, com contagem) e resumo em módulos |
| 38–47s | **03 · Portal Sempre Juntos** — retorno ao `#f3f3f3`, foto 2 em caco (Ativo 32) e CTA |
| 47–53s | **04 · Fechamento** — logo "O jeito Agi \| Crescer na jornada" com cacos amarelos |

- Tipografia: somente Agibank Sans de `assets/fonts/` — **Light** no texto corrido e **Bold** nos destaques. Em fundo claro, todo o texto é Azul Agibank `#0064f5`.
- Quebras de linha: artigos e preposições curtas (e, de, a, da, do, para, com…) nunca terminam linha, e as linhas são equilibradas para não deixar viúvas (`layoutRich` em `src/telao.js`).
- Cacos de `assets/shapes/`: o polígono de cada caco é extraído do SVG original (proporção preservada) e redesenhado com cantos de **15px** (faixa 12–17px das diretrizes). Os módulos do resumo também usam 15px.
- Texto nunca sobrepõe cacos/fotos; os confetes ficam nas margens e somem da área dos módulos.

## Arquivos privados (fora do Git)

As fotos de colaboradores e os logos da campanha **não são versionados** (`.gitignore` cobre `projetos/**/private/` e `projetos/**/dist/`). Antes de gerar, coloque em `private/`:

```
private/foto-1.jpg                  # colaboradoras (DSC01585)
private/foto-2.jpg                  # selfie em grupo (tdd_2025-193)
private/logo-campanha.png           # "O jeito Agi | Crescer na jornada" (positivo, PNG transparente 1920x1080)
private/logo-campanha-negativo.png  # mesma marca em branco, usada sobre o azul
```

## Gerar

```bash
node build.cjs    # -> dist/telao-preview.html (auto-contido: player com Play/Pause/Restart + exportação MediaRecorder)
node render.cjs   # -> dist/telao-campus.mp4 (H.264, CRF 15) via Playwright + FFmpeg
```

`render.cjs` aceita `--from 12 --to 38 --out cena03.mp4` para renderizar trechos.

Roteiro, tempos e layout ficam em `src/telao.js`; o player em `src/player.html`.
