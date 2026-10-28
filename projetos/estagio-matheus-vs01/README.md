# VS01 · Programa de Estágio Agi (Matheus) — letterings

Sete letterings animados sincronizados com a fala do Matheus em `MONTAGEM_VS01_1.mp4` (1920×1080, 23,976 fps).
O vídeo **não é versionado** (`*.mp4`/`*.mov` estão no `.gitignore`): coloque o arquivo nesta pasta para usar o player e o render.

## Gatilhos (timestamps por palavra)

Extraídos com faster-whisper (modelo `small`, timestamps por palavra) → `transcricao.json`.

| # | Lettering | Palavra-gatilho | Entrada | Saída |
|---|-----------|-----------------|---------|-------|
| 1 | GC “Matheus / Estagiário em Governança de TI” | “eu **sou** o Matheus” | 01:14.72 | 01:19.00 |
| 2 | Prazo “Inscrições até dia 08” | “**correr** e se inscrever” · “dia 08” acende em “**dia**” (01:31.20) | 01:27.96 | 01:32.85 |
| 3 | Bolsa-auxílio `R$ 2.400` | “**bolsa**-auxílio” | 01:34.54 | 01:38.20 |
| 4 | VA e VR `+ de R$ 1.200` | “**VA e VR**” | 01:36.36 | 01:38.20 |
| 5 | Tags (uma a uma) | “**flexibilidade**” · “**mentoria**” (01:40.52) · “**aplicar** IA” (01:41.82) | 01:38.46 | 01:44.40 |
| 6 | Requisito “Graduação a partir do 4º semestre” | “você **precisa** estar cursando” | 01:45.08 | 01:50.75 |
| 7 | “100% Presencial · Campinas” | “**100**% presencial” | 01:50.94 | 01:54.20 |

Os cards 3 e 4 ficam empilhados (o 4 entra abaixo do 3) para dar tempo de leitura aos dois valores.

## Arquivos

- `player.html` — player interativo: vídeo + letterings ao vivo, ajuste de cada gatilho (±0,1 s / ±0,5 s), exportação `cues.json`.
- `letterings.js` / `letterings.css` — motor único (função pura do tempo), usado pelo player e pelo render.
- `overlay.html` — palco transparente 1920×1080 usado pelo render.
- `render.mjs` — renderiza o overlay quadro a quadro (Playwright) e compõe sobre o vídeo (ffmpeg, áudio copiado sem recompressão).
- `build-assets.mjs` → `assets.generated.js` — embute ícones/formas de `/assets` (rode de novo se trocar algum SVG).

## Como usar

Abra o player servindo a raiz do repositório (as fontes carregam de `/assets/fonts`):

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000/projetos/estagio-matheus-vs01/player.html`. Ajuste os gatilhos e clique em **Baixar cues.json**.

Render final (com ou sem os ajustes):

```bash
node projetos/estagio-matheus-vs01/render.mjs projetos/estagio-matheus-vs01/MONTAGEM_VS01_1.mp4 --cues cues.json
```

Saída: `projetos/estagio-matheus-vs01/render/MONTAGEM_VS01_letterings.mp4`. Para conferir só alguns quadros: `--preview 76.5,97.8`.

## Regras aplicadas

- Agibank Sans Bold/Regular; cantos de 15px em todos os módulos e tags.
- Contraste conforme `docs/diretrizes-design.md` (branco sobre azul, azul-escuro sobre verde/branco, amarelo só como detalhe sobre azul-escuro).
- Valores `R$ 2.400` / `+ de R$ 1.200`, numeral `dia 08` (`docs/manual-verbal.md`).
- Letterings na lateral esquerda, abaixo da marca “Programa de estágio” (reserva do logo preservada) e fora do rosto do Matheus nos dois enquadramentos (close e plano aberto).
- Formas de `/assets/shapes` só como detalhe nas bordas dos cards, nunca sob texto.
