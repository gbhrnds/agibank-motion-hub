# Giro Meetup Agibank RH — motion 16:9

Vídeo 100% motion design para redes sociais · **1920 × 1080 · 24 fps · 30 s**.

| Arquivo | O que é |
| --- | --- |
| `giro-meetup-agibank-rh-1920x1080-24fps.mp4` | Render final (H.264, yuv420p, 720 quadros) |
| `meetup-rh-motion.html` | Player auto-contido (fontes e SVGs embutidos): Play/Pause, Restart, linha do tempo, seletor de cenas e exportação de vídeo (MP4 quando o navegador suporta, senão WebM) |
| `src/template.html` | Fonte do motor de animação (canvas, função `render(t)` determinística) |
| `build.cjs` | Embute `assets/` no template e gera o player |
| `render.cjs` | Renderiza quadro a quadro com Playwright + ffmpeg |

## Roteiro

| Cena | Tempo | Fundo | Conteúdo |
| --- | --- | --- | --- |
| 01 Gancho | 00–06s | Azul Escuro + formas irregulares azul/verde | Lettering em blocos com destaque verde e sublinhado em "acelerar o futuro" e "inteligência de verdade" |
| 02 Desafio | 06–09s | Wipe em módulo diagonal → Azul Agibank | "Faça os testes e descubra se você deve marcar presença no Meetup Agibank RH" + triângulo em traço verde (PDF) |
| 03 IA no RH | 09–16s | Azul Escuro | Fluxograma desenhado com linhas que acendem; convergência no card "Então pode vir!" |
| 04 Dados no RH | 16–23s | Azul Médio | Fluxograma em Verde Claro; os dois caminhos convergem num nó central de aprovação |
| 05 Encerramento | 23–30s | Cinza-claro + módulo `Ativo 65` e formas | Lettering de impacto, CTA em Azul Agibank e badge com a URL |

Regras aplicadas: só Agibank Sans (Light/Regular/Bold), paleta oficial, cantos de 15px em cards, caixas e
transições (o módulo `Ativo 65` é escalado para o canto renderizar com 15px), divisões diagonais não paralelas
com respiro entre módulos, nenhum texto sobre as formas irregulares, nenhum emoji.

## Regerar

```bash
node projetos/giro-meetup-rh/build.cjs
```

```bash
node projetos/giro-meetup-rh/render.cjs
```

Quadros avulsos para revisão: `node projetos/giro-meetup-rh/render.cjs --stills 3,12.5,29 ./stills`
