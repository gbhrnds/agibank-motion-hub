---
name: editar-video
description: Estúdio de edição Agibank. Use sempre que receber um vídeo bruto ou um pedido de edição — cortar vícios de linguagem (é, hum, tipo, né), pausas e repetições, montar takes, legendar, aplicar cor, adicionar motion graphics da marca (lower third, destaque, cartela de título, encerramento) e renderizar o final.mp4. Combina o pipeline do video-use (transcrição → EDL → render) com o HyperFrames (motion em HTML) e a identidade visual Agibank.
---

# Estúdio de edição Agibank

Fluxo completo: **vídeo bruto → transcrição → cortes → motion graphics → legenda → render → autoavaliação**.
Baseado em [browser-use/video-use](https://github.com/browser-use/video-use) (MIT) e
[heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) (Apache-2.0), adaptado para pt-BR e para a marca.

O LLM não assiste ao vídeo: ele **lê** o vídeo pela transcrição com tempo por palavra e olha frames só nos
pontos de decisão (`timeline_view.py`). Áudio manda, imagem acompanha.

Scripts em `studio/helpers/` (rode a partir da raiz do repo). Setup: `bash studio/setup.sh`.

## Regras fixas (correção técnica — não negociáveis)

1. **Legenda é a ÚLTIMA camada**, depois de todos os overlays (senão o overlay esconde a legenda).
2. **Extração por trecho → concat sem recodificar** (`render.py` já faz).
3. **Fade de 30 ms no áudio em todo corte** (evita estalo; `render.py` já faz).
4. **Overlay com `setpts=PTS-STARTPTS+T/TB`** para o frame 0 cair no início da janela (`render.py` já faz).
5. **Legenda no tempo de SAÍDA**: `t_saida = palavra.start - inicio_trecho + offset_trecho`.
6. **Nunca cortar dentro de uma palavra.** Toda borda de corte cai num limite de palavra da transcrição.
7. **Folga em toda borda de corte**: janela de 30–200 ms (a transcrição desvia 50–100 ms).
8. **Transcrição palavra a palavra e literal** (nunca SRT/frase; nunca normalizar vícios).
9. **Transcrição em cache por arquivo.** Nunca retranscrever um bruto que não mudou.
10. **Várias animações = subagentes em paralelo** (um slot por agente, via `Agent`), nunca em sequência.
11. **Confirmar a estratégia com a pessoa antes de cortar.** Nada é renderizado sem o "ok" do plano.
12. **Tudo que for gerado fica em `projetos/<nome>/edit/`.** Nunca escrever dentro de `studio/`.

Tudo o mais é exemplo de trabalho, não regra — adapte ao material.

## Estrutura de um projeto

```
projetos/<nome>/
├── <brutos: .mp4/.mov, intocados>
└── edit/
    ├── project.md          ← memória; uma seção por sessão
    ├── transcripts/*.json  ← transcrição palavra a palavra (cache)
    ├── takes_packed.md     ← transcrição por frases, a visão principal de leitura
    ├── cortes.md           ← o que fillers.py propõe remover (revisar!)
    ├── edl.json            ← decisões de corte, overlays, cor
    ├── animations/slot_<id>/  ← cada motion graphic é um projeto HyperFrames
    ├── master.ass / master.srt
    ├── verify/             ← frames/PNGs de conferência
    ├── preview.mp4
    └── final.mp4
```

Se a pessoa mandar o arquivo em outro lugar (upload), mova/copie para `projetos/<nome>/` primeiro.

## O processo

1. **Abrir.** Se `edit/project.md` existe, resuma a última sessão em uma frase e pergunte se continua.
2. **Inventário.** `ffprobe` em cada bruto (duração, resolução, orientação, fps, faixas de áudio).
   ```bash
   python3 studio/helpers/transcribe_batch.py projetos/<nome>           # ou transcribe.py <video>
   python3 studio/helpers/pack_transcripts.py --edit-dir projetos/<nome>/edit
   ```
   Motor de transcrição: `--engine auto` usa ElevenLabs Scribe se houver `ELEVENLABS_API_KEY`
   (melhor para vícios: preserva "é...", "hã"), senão faster-whisper local (`--whisper-model medium`
   ou `large-v3` para mais precisão). Idioma padrão `pt`.
   Dê uma olhada em 1–2 `timeline_view.py` para uma primeira impressão visual.
3. **Pré-varredura.** Leia `takes_packed.md` e rode o detector:
   ```bash
   python3 studio/helpers/fillers.py projetos/<nome>/<bruto>.mp4 [--agressivo] [--max-pausa 0.5] [--punch-in 1.08]
   ```
   Ele gera `cortes.md` (lista revisável) e um `edl.json` rascunho. É um primeiro passe: "é" verbo,
   "então" conectivo e "né" de ênfase ficam; só sai o que está isolado por pausa ou alongado.
   Com Whisper local, alguns vícios somem da transcrição — confira trechos suspeitos com `timeline_view.py`
   (forma de onda com fala sem palavra = vício não transcrito).
4. **Conversar.** Descreva o material em português simples e pergunte o que o material pede:
   objetivo e público, duração e formato (16:9, 9:16 vertical, 1:1), ritmo, trechos que precisam ficar
   ou sair, legenda (estilo), motion graphics (quais e onde), cor, música.
5. **Propor estratégia** (4–8 frases): estrutura, cortes, motion, cor, legenda, duração estimada.
   **Espere a confirmação.**
6. **Executar.**
   - Ajuste `edl.json` (escolha de takes, ordem por blocos, cortes manuais). Para vários takes do mesmo
     trecho, escolha o melhor take por bloco (estrutura: GANCHO → PROBLEMA → SOLUÇÃO → BENEFÍCIO → CTA,
     ou a que o material pedir).
   - Motion graphics: um slot por animação, criados **em paralelo** (ver abaixo).
   - Cor: `"grade": "none"` (padrão), `"neutral_punch"`, `"warm_cinematic"`, `"auto"` ou um filtro ffmpeg cru.
7. **Preview.**
   ```bash
   python3 studio/helpers/render.py projetos/<nome>/edit/edl.json -o projetos/<nome>/edit/preview.mp4 --preview --build-subtitles
   ```
8. **Autoavaliação (antes de mostrar).** `timeline_view.py` no **arquivo renderizado** em cada corte (±1,5 s):
   salto visual, pico de áudio (estalo), legenda escondida por overlay, overlay fora de hora.
   Amostre também início, fim e 2–3 pontos do meio. `ffprobe` na duração (bate com `total_duration_s`
   + cartelas?). Meça o áudio: `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` (alvo −14 LUFS,
   pico ≤ −1 dBTP). Você não ouve: reporte os números. Até 3 passes de correção; se sobrar problema,
   diga qual.
9. **Iterar e persistir.** Ajuste pelo feedback, nunca retranscreva. Render final (sem `--preview`)
   quando aprovado. Acrescente a sessão em `project.md`:
   ```markdown
   ## Sessão N — AAAA-MM-DD
   **Estratégia:** …
   **Decisões:** takes, cortes, motion, cor + por quê
   **Pendências:** …
   ```

## Ofício de corte

- Cortes candidatos vêm de limites de palavra e silêncios. Silêncio ≥ 400 ms é o corte mais limpo;
  150–400 ms funciona com conferência visual; < 150 ms é arriscado.
- Folga de exemplo: 50 ms antes da primeira palavra mantida, 80 ms depois da última.
- Preserve picos: risada, ênfase, a reação depois da frase de efeito.
- Jump cut em talking head: `--punch-in 1.08` alterna um zoom leve (campo `"zoom"` do trecho na EDL)
  para disfarçar o salto. Ou cubra o corte com um overlay.
- Nunca pense áudio e vídeo separados: todo corte precisa funcionar nas duas trilhas.

## Formato da EDL

```json
{
  "version": 1,
  "sources": {"bruto": "/abs/projetos/x/bruto.mp4", "titulo": "/abs/projetos/x/edit/animations/slot_titulo/render.mp4"},
  "ranges": [
    {"source": "titulo", "start": 0, "end": 4, "beat": "ABERTURA"},
    {"source": "bruto", "start": 2.30, "end": 6.85, "beat": "GANCHO", "quote": "...", "reason": "..."},
    {"source": "bruto", "start": 9.10, "end": 14.2, "zoom": 1.08}
  ],
  "grade": "none",
  "overlays": [
    {"file": "animations/slot_lt/render.webm", "start_in_output": 4.5, "duration": 5.0}
  ],
  "subtitles": "master.ass",
  "total_duration_s": 87.4
}
```

- **Cartelas opacas** (`titulo`, `encerramento`) entram como **trechos** em `ranges` (fonte sem áudio
  recebe silêncio automaticamente). Elas empurram o tempo de saída: recalcule `start_in_output`
  dos overlays depois delas.
- **Overlays transparentes** (`lower-third`, `destaque`) entram em `overlays` como `.webm` com alfa,
  no tempo de **saída** (após os cortes). Caminhos relativos são relativos à pasta da EDL.
- `--build-subtitles` gera `master.ass` (queimado) e `master.srt` (para subir como legenda à parte).

## Motion graphics (HyperFrames + marca)

```bash
python3 studio/helpers/motion.py list
python3 studio/helpers/motion.py new lower-third projetos/<nome>/edit/animations/slot_lt \
    --duration 5 --orient landscape --var nome="Ana Souza" --var cargo="Analista de Dados"
python3 studio/helpers/motion.py render projetos/<nome>/edit/animations/slot_lt   # lint + check + render
```

| Template | Uso | Variáveis | Saída |
|---|---|---|---|
| `lower-third` | nome e cargo de quem fala | `nome`, `cargo` | `.webm` com alfa → `overlays` |
| `destaque` | palavra-chave ou número que a pessoa fala | `texto`, `apoio` (pode ser vazio) | `.webm` com alfa → `overlays` |
| `titulo` | abertura / capítulo, módulos diagonais | `titulo`, `subtitulo` | `.mp4` opaco → `ranges` |
| `encerramento` | assinatura com logo e CTA | `frase`, `cta` | `.mp4` opaco → `ranges` |

`--orient landscape|portrait|square` precisa casar com o formato do vídeo final.

**Sincronia:** um destaque deve *pousar* na palavra falada: pegue o tempo de saída da palavra e comece o
overlay ~0,5 s antes. Lower third: entra 0,5–1 s depois que a pessoa começa a falar, fica 4–6 s.
Densidade: um card a cada 6–8 s em vídeos de até 1 min, não mais.

**Motion sob medida:** quando nenhum template serve, edite o `index.html` do slot (é um projeto
HyperFrames normal) ou crie um do zero copiando um template. Contrato HyperFrames:
- todo elemento temporizado tem `class="clip"`, `data-start`, `data-duration`; a duração do vídeo é
  o `data-duration` da raiz;
- uma timeline GSAP pausada registrada em `window.__timelines["main"]`; nada de `Date.now()`,
  `Math.random()` sem semente, timers, rede ou `repeat: -1` — tudo é função do tempo;
- nunca animar `display`/`visibility` de um `.clip`; animar transforms, não `left/top/width/height`;
- fontes e scripts locais (`assets/`): o render não acessa a internet. GSAP está em `assets/gsap.min.js`;
- `npx hyperframes@0.8.212 lint` e `check --json` têm que passar; `snapshot --at 1,2,3` e **olhe os PNGs**.
Para mais (registro de ~450 blocos prontos, legendas animadas, transições): `npx hyperframes@0.8.212 docs <tópico>`,
`npx hyperframes@0.8.212 catalog --json`, ou instale as skills: `npx hyperframes skills update`.

**Ofício de movimento:** chegada lenta (`expo.out`/`power4.out`), saída 40–50% mais curta (`power3.in`);
nunca `linear`; título pousou = fica parado; um elemento novo por vez (sobreposição de 30–50%);
segurar a última tela ≥ 1 s (frase final ≥ 2 s); leitura ≈ 0,5 s + 0,3 s por palavra.

**Brief de subagente (uma animação cada, em paralelo):** objetivo em 1 frase; caminho absoluto do slot;
template ou especificação (resolução, fps, duração); textos exatos; paleta e regras da marca (abaixo);
linha do tempo quadro a quadro com easing; o que NÃO fazer; checklist (lint, check, snapshot olhado,
render, duração conferida com ffprobe); "Não faça perguntas; se algo for ambíguo, escolha a
interpretação mais óbvia e siga."

## Identidade Agibank (fonte: `assets-map.md` e `docs/`)

- **Cores:** Azul Agibank `#0064f5` (obrigatório em toda peça), Azul Médio `#0033b0`, Azul Escuro `#000f44`,
  Verde `#77df40`, Verde Claro `#C9FF90`, Amarelo `#FFD600` (só detalhe), Branco.
- **Contraste:** sobre azul `#0064f5` → só branco; sobre azul-escuro → branco, verde-claro ou amarelo;
  sobre verde ou amarelo → só azul-escuro; sobre branco → azul-escuro ou azul-médio.
- **Tipografia:** Agibank Sans (`assets/fonts/`): Bold para títulos, Regular para corpo/legendas.
- **Logos:** `assets/logos/` (positivo/negativo, completo/reduzido "agi"). Área de proteção ≥ 3× o pingo
  verde do "i". Nunca logo ou texto sobre textura.
- **Módulos diagonais:** cantos 12–17 px (templates usam 14), vão de 5–8% do módulo, bordas externas
  retas, divisões internas diagonais e **nunca paralelas**. Referências em `assets/modulos/`.
- **Formas irregulares** (`assets/shapes/`): podem girar, espelhar, escalar — nunca distorcer.
- **Texto na tela** (`docs/manual-verbal.md`): "o Agibank"; "Agilizados" em tom motivacional;
  CTA no imperativo/presente do subjuntivo ("Acesse", "Confira", "Fique por dentro");
  números com zero à esquerda (01, 02); sem diminutivos, sem regionalismos, sem anglicismos
  ("dinheiro de volta", não "cashback"); evite datas fixas.
- **EVP** (`docs/evp.md`): "Você cresce. O Agibank cresce com você." — frase-assinatura para encerramentos
  de marca empregadora.

## Legendas

Estilos (`render.py --caption-style`): `caixa` (padrão — Agibank Sans Bold, branco sobre caixa azul
`#0064f5`, 4 palavras), `contorno` (branco com contorno azul-escuro), `maiusculas` (2 palavras em caixa
alta, ritmo de rede social). Posição: 16:9 a ~8,5% da base; 9:16 a ~30% da base (fora da UI de
Reels/TikTok/Shorts). Lower thirds dos templates já ficam acima dessa faixa.

## Anti-padrões

Editar antes de confirmar a estratégia · retranscrever bruto em cache · cortar dentro de palavra ·
legenda antes dos overlays · easing linear · fonte web sem verificar (cai em fallback calado) ·
efeito sonoro em toda transição · animações em sequência em vez de paralelo · supor o tipo de vídeo
sem olhar o material · cor/forma fora da marca.
