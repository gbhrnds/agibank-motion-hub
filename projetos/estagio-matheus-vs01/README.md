# VS01 · Programa de Estágio Agi (Matheus) — letterings

Seis letterings animados sincronizados com a fala do Matheus em `MONTAGEM_VS01_1.mp4` (1920×1080, 23,976 fps).
O vídeo **não é versionado** (`*.mp4`/`*.mov` estão no `.gitignore`): coloque o arquivo nesta pasta para usar o player e o render.

## Gatilhos (timestamps por palavra)

Extraídos com faster-whisper (modelo `small`, timestamps por palavra) → `transcricao.json`.

| # | Lettering | Palavra-gatilho | Entrada | Saída |
|---|-----------|-----------------|---------|-------|
| 1 | GC “Matheus / Estagiário em Governança de TI” (sobreposto azul/verde) | “eu **sou** o Matheus” | 01:14.72 | 01:19.00 |
| 2 | Logo do Programa de Estágio + “Inscrições até o dia 08” (mesma largura do logo) | “**correr** e se inscrever” · “dia 08” acende em verde em “**dia**” (01:31.20) | 01:27.96 | 01:32.85 |
| 3 | Benefícios em coluna: Bolsa-auxílio `R$ 2.400` → VA e VR `+ de R$ 1.200` → Flexibilidade → Mentoria → IA | “**bolsa**” · “VA e VR” (01:36.36) · “flexibilidade” (01:38.46) · “mentoria” (01:40.52) · “aplicar IA” (01:41.82) | 01:34.54 | 01:44.40 |
| 4 | Requisito “Graduação a partir do 4º semestre” (sobreposto azul/verde) | “você **precisa** estar cursando” | 01:45.08 | 01:50.75 |
| 5 | “100% Presencial” + selo “Campinas” na mesma largura | “**100**% presencial” | 01:50.94 | 01:54.20 |
| 6 | Frase final “com inteligência, com a gente!” — uma palavra por vez, lateral esquerda | “com” (01:59.06) · “inteligência” (01:59.42) · “com” (02:00.30) · “a” (02:00.44) · “gente” (02:00.56) | 01:59.06 | 02:02.40 |

Padrão visual: boxes só em Azul Agibank (`#0064f5`, texto branco) e Verde (`#77df40`, texto azul-escuro), cantos de 15px,
com o caco em outline verde com neon do KV (`assets_programa_de_estagio/graphics/forma_irregular_01.svg`) se desenhando no canto de cada box, com rotação leve contínua.
Na coluna de benefícios os textos são centralizados nos boxes.
Na coluna de benefícios cada item tem box de título + box de valor, todos com a mesma largura; a coluna é ancorada embaixo e sobe conforme os novos itens entram.

## Arquivos

- `player.html` — player interativo: vídeo + letterings ao vivo, ajuste de cada gatilho (±0,1 s / ±0,5 s), exportação `cues.json`.
- `letterings.js` / `letterings.css` — motor único (função pura do tempo), usado pelo player e pelo render.
- `overlay.html` — palco transparente 1920×1080 usado pelo render.
- `render.mjs` — renderiza o overlay quadro a quadro (Playwright) e compõe sobre o vídeo (ffmpeg, áudio copiado sem recompressão).
- `build-assets.mjs` → `assets.generated.js` — embute o caco e o logo de `/assets_programa_de_estagio` (o logo é normalizado: sem contorno preto, selo verde com texto azul-escuro). Rode de novo se trocar algum SVG.

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

Saída: `projetos/estagio-matheus-vs01/render/MONTAGEM_VS01_letterings.mp4`. Para conferir só alguns quadros: `--preview 76.5,97.8`; para um clipe de prévia: `--trecho 86.5,113.5`.

Só os letterings em .mov RGB+alpha (duração total, começando em 00:00, para soltar sobre o vídeo na timeline):

```bash
node projetos/estagio-matheus-vs01/render.mjs projetos/estagio-matheus-vs01/MONTAGEM_VS01_1.mp4 --alpha prores
```

`--alpha prores` = ProRes 4444 com alfa · `--alpha animation` = QuickTime Animation (sem perda) · `--alpha ambos`.

## Regras aplicadas

- Agibank Sans Bold/Regular; cantos de 15px em todos os boxes.
- Contraste conforme `docs/diretrizes-design.md` (branco sobre azul, azul-escuro sobre verde).
- Valores `R$ 2.400` / `+ de R$ 1.200`, numeral `dia 08` (`docs/manual-verbal.md`).
- Letterings na lateral esquerda, abaixo da marca “Programa de estágio” (reserva do logo preservada) e fora do rosto do Matheus nos dois enquadramentos (close e plano aberto).
- O caco fica atrás dos boxes, nunca sob texto, e fora do rosto e da reserva do logo.
