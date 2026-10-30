# Agibank Motion Hub — estúdio de edição de vídeo

Este repositório é um estúdio de edição: a pessoa envia um vídeo bruto e o Claude entrega o
`final.mp4` editado (sem vícios de linguagem, pausas e repetições), com legenda e motion graphics da
marca Agibank.

**Para qualquer pedido de edição de vídeo, siga a skill `.claude/skills/editar-video/SKILL.md`.**
Ela tem as regras fixas, o processo (inventário → estratégia confirmada → cortes → motion → render →
autoavaliação) e a identidade visual.

## Mapa

- `studio/helpers/` — scripts (Python + ffmpeg): `transcribe.py`, `transcribe_batch.py`,
  `pack_transcripts.py`, `fillers.py`, `timeline_view.py`, `grade.py`, `render.py`, `motion.py`.
- `studio/motion/templates/` — composições HyperFrames da marca (`lower-third`, `destaque`, `titulo`,
  `encerramento`); `studio/motion/brand/brand.css` com os tokens.
- `projetos/<nome>/` — brutos e a pasta `edit/` de cada projeto (vídeos ficam fora do git).
- `assets/` — fontes, logos, ícones, formas e módulos oficiais. `assets-map.md` — catálogo e cores.
- `docs/` — diretrizes de design, manual verbal e EVP. Respeite-os em todo texto e grafismo.

## Ambiente

- Início de sessão: `bash studio/setup.sh` (deps Python, GSAP local, checa ffmpeg/Node 22/HyperFrames).
- Transcrição: com `ELEVENLABS_API_KEY` (em `studio/.env` ou no ambiente) usa Scribe; sem ela, Whisper
  local — que baixa o modelo de `huggingface.co` no primeiro uso.
- Testes: `python3 -m unittest discover -s studio/tests`.
- Código adaptado de browser-use/video-use (MIT) e usando heygen-com/hyperframes (Apache-2.0);
  licenças em `studio/licenses/`.
