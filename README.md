# agibank-motion-hub

Hub de motion do Agi — e estúdio de edição de vídeo operado pelo Claude.

## Como usar

1. `bash studio/setup.sh`
2. Coloque o vídeo bruto em `projetos/<nome-do-projeto>/`
3. Peça ao Claude, por exemplo: *"edita esse vídeo: tira os vícios de linguagem, coloca lower third
   com meu nome e cargo, legenda e encerramento da marca"*

O Claude transcreve, propõe os cortes e a estratégia, espera seu ok, monta os motion graphics da marca
(HyperFrames), renderiza e confere o resultado antes de te mostrar. Saída em
`projetos/<nome>/edit/final.mp4`.

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `studio/helpers/` | Pipeline de edição: transcrição (Scribe ou Whisper local), detecção de vícios em pt-BR, EDL, render com ffmpeg, legendas da marca, motion |
| `studio/motion/templates/` | Motion graphics Agibank em HyperFrames: `lower-third`, `destaque`, `titulo`, `encerramento` |
| `.claude/skills/editar-video/` | O manual de edição que o Claude segue |
| `assets/`, `assets-map.md`, `docs/` | Identidade visual e verbal oficial |

## Créditos

- [browser-use/video-use](https://github.com/browser-use/video-use) — MIT. Helpers adaptados em `studio/helpers/`.
- [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) — Apache-2.0. Usado via `npx hyperframes`.

Licenças em `studio/licenses/`.
