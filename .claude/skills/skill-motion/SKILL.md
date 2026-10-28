---
name: skill-motion
description: Criar letterings animados (GC, cards, valores, tags, frases palavra a palavra) sincronizados com a fala de um vídeo do Agibank, com player de ajuste fino e entrega em .mov RGB+alpha para o Premiere. Use quando pedirem lettering, GC, lower third, motion de texto, card animado ou legenda animada em vídeo.
---

# Skill-motion — letterings em vídeo do Agibank

Aprendizados consolidados do projeto `projetos/estagio-matheus-vs01/` (Programa de Estágio, Matheus).
**Essa pasta é a implementação de referência**: comece copiando `letterings.js`, `letterings.css`,
`overlay.html`, `player.html`, `render.mjs` e `build-assets.mjs` para `projetos/<novo-projeto>/` e adapte.

## 1. Fluxo de trabalho (combinado com o time)

1. Ler `docs/diretrizes-design.md`, `docs/manual-verbal.md` e `assets-map.md`.
2. Transcrever o áudio com timestamps **por palavra** e localizar as palavras-gatilho (seção 3).
3. Mapear o enquadramento: folha de contato (1 quadro/s) do trecho dos letterings para ver onde
   ficam rosto, cortes de câmera e a marca d'água/logo já aplicada no vídeo.
4. Construir os letterings e mandar **prévias para aprovação antes do render**:
   prancha de quadros (`--preview t1,t2,…`) + clipe curto (`--trecho a,b`) quando houver movimento
   (rotação, bounce) — foto não mostra animação.
5. Iterar com o feedback. Só depois de aprovado: render final.
6. Entregar o **.mov QuickTime Animation RGB+alpha** (seção 6) + .mp4 de referência com o vídeo base.
7. Commitar só código/JSON. **Nunca versionar vídeo**: `.gitignore` com `*.mp4`, `*.mov`, `projetos/*/render/`.

Comunicação com o time em português.

## 2. Regras de marca aplicadas (e aprovadas)

- Fonte: Agibank Sans (`assets/fonts/AgibankSans-Bold.woff2` / `-Regular.woff2`).
- Cantos dos boxes: **15px** (diretriz: 12–17px).
- Cores dos boxes: preferência **Azul Agibank `#0064f5`** (texto branco) e **Verde `#77df40`** (texto
  azul-escuro `#000f44`). Itens secundários/diferenciais em **Azul Médio `#0033b0`** (texto branco).
  Destaques de texto sobre azul em verde `#77df40`.
- Valores: `R$ 2.400`, `+ de R$ 1.200` (nunca por extenso). Numerais até 9 com zero: `dia 08`.
- Grafismo: **caco em outline verde com neon** do KV
  (`assets_programa_de_estagio/graphics/forma_irregular_01.svg`), no canto superior direito do box,
  parcialmente atrás dele, se desenhando + rotação leve contínua. Nunca sob texto.
- Logo do Programa de Estágio: `assets_programa_de_estagio/logo/logo_programa.svg` — o export vem com
  contorno preto e selo branco sobre branco; `build-assets.mjs` normaliza (branco, selo verde com texto
  azul-escuro, pingo do "i" verde).
- Ícones genéricos foram **removidos** a pedido (não combinavam com a fala). Não usar sem pedido.
- Escala geral aprovada: **0,8** (`--escala` em `letterings.css`).
- Posição: coluna esquerda, ancorada embaixo, abaixo da marca d'água do vídeo (preservar reserva do
  logo) e **sem cobrir o rosto** em nenhum enquadramento (close e plano aberto).
- Frase de fechamento: lateral, alinhada à esquerda, palavra por palavra, highlight verde, com
  maiúscula inicial e a quebra de linha que o time indicar.

## 3. Transcrição (ambiente cloud)

- Hugging Face e CDNs de modelo são bloqueados pelo proxy. O Whisper `small` (CTranslate2 int8) está
  no npm em 4 partes: `@skillninja/shortmovie-telop-model-p0..p3` — baixar os `.tgz`, concatenar
  `model.bin.part0..3` → `model.bin`, conferir o `model.sha256`, copiar `config.json`,
  `tokenizer.json`, `vocabulary.json`, `preprocessor_config.json`.
- `pip install faster-whisper`; o PyAV instalado é incompatível com `decode_audio`, então extraia
  `ffmpeg -ac 1 -ar 16000 audio.wav` e passe o array numpy (int16/32768) para `transcribe(...,
  language="pt", word_timestamps=True)`.
- A transcrição erra grafia (nomes, "Agi"), mas os tempos das palavras são confiáveis. Salve em
  `transcricao.json` no projeto.
- Gatilho = início da palavra falada. A fala real pode diferir do roteiro: avise e sincronize com o
  que foi dito.

## 4. Arquitetura (motor único)

- `letterings.js`: `DEFAULT_CUES` (id, in, out, `marks` internos) + `render(t)` **função pura do tempo**.
  O mesmo código roda no player (tempo real) e no render (quadro a quadro) — o que se vê no player é o
  que sai no vídeo.
- Palco fixo 1920×1080; player escala o palco para o tamanho do vídeo.
- `player.html`: vídeo + overlay ao vivo, ±0,1/±0,5 s por gatilho (mover a entrada desloca o cue
  inteiro), atalhos de quadro, salva em localStorage, exporta `cues.json` para o render.
- `render.mjs`: Playwright em `overlay.html` servido por HTTP local, screenshot com
  `omitBackground` no **tempo exato do quadro** `n * 1001/24000`; ffmpeg compõe. Opções:
  `--cues`, `--preview`, `--trecho a,b`, `--alpha animation|prores|ambos`.
- Abrir via `file://` bloqueia fontes/SVG por CORS: servir a raiz do repo
  (`python3 -m http.server`) e **embutir SVGs** em `assets.generated.js` (`build-assets.mjs`).
- Medições (ex.: chamada com a mesma largura do logo) só funcionam com o cue visível e as fontes
  carregadas: calcule dentro da animação do cue, não no mount.

## 5. Animação — o que funcionou

- Entradas: wipe por `clip-path` + texto subindo de máscara + **bounce** (mola amortecida
  `1 - e^(-6x)·cos(3.2πx)`) em posição e escala; contagem animada de valores com largura fixa do
  número (`width: 3ch` + `tabular-nums`) para o box não "pulsar".
- Coluna que cresce: cada item anima a altura de 0 → natural (ancorada embaixo) e empurra os
  anteriores para cima. Bom para listas de benefícios que precisam de mais tempo de leitura.
- Momentos separados no mesmo card (ex.: logo primeiro, depois "Inscrições até o dia 08" no gatilho
  "Inscrições") com o box crescendo.
- Saída: varredura para a esquerda; frase final com fade.
- **Máscaras e recortes cortam bounce/escala** — regras:
  - máscara com folga (padding/margin negativos) no topo e nas laterais;
  - folga em **px** para elementos grandes (SVG de logo), porque `em` herda fonte pequena;
  - liberar `overflow`/`clip-path` (`none`) assim que a entrada termina;
  - conferir prévias nos **picos do overshoot** (~0,27 da duração da mola) de cada elemento.
- Use as propriedades CSS independentes `scale`, `rotate`, `translate` para não brigar com o
  `transform` usado em outras etapas (saída, rotação base do caco).

## 6. Entrega com alpha (IMPORTANTE)

- **Formato que funcionou no Premiere Pro: QuickTime Animation (`qtrle`, `-pix_fmt argb`)**,
  duração total do vídeo, começando em 00:00, alpha reto (straight). ~78 MB para 2:12.
- O ProRes 4444 gerado pelo ffmpeg (`prores_ks`) apareceu **preto** no Premiere do time — não
  entregar como formato principal.
- Sintoma de alpha não lido: fundo preto, neon do caco virando "mancha" verde com anéis, sombra de
  texto virando contorno escuro. Não é defeito da animação.
- Validar antes de entregar: profundidade 32 no `stsd` e compor um quadro extraído (PNG rgba) sobre
  fundo cinza. Dica ao time: Interpretar gravação → Canal alfa → não ignorar.
- Fallback universal: sequência de PNG com transparência.
