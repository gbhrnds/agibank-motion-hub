# agibank-motion-hub — Agibank Brand Studio

Hub de marca do Agi. Este repositório contém os assets oficiais (`/assets`), o mapa de tokens
(`/config/assets-map.json`, **única fonte de verdade** de cores, tipografia, paths e regras), os padrões
de composição de peças aprovadas (`/config/composition-patterns.json`, com referências em `/references/popups`) e o
**MVP do Brand Studio**: gerador do Alerta institucional de Comunicação Interna 600×600
(canais "Alerta Sempre Juntos" e "Alerta Teams").

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run dev` / `npm run build` executam antes `scripts/sync-assets.mjs`, que:

- copia `/assets` → `/public/assets` (o Next.js só serve estáticos de `/public`);
- gera `app/fonts.generated.css` com os `@font-face` a partir de `typography.weights` do `assets-map.json`
  (importado por `app/globals.css`).

Ambos os arquivos gerados estão no `.gitignore`.

## Estrutura

| Caminho | Papel |
| --- | --- |
| `app/page.tsx` | Página única: canvas + painel de validação + export |
| `components/canvas/AlertaCanvas.tsx` | Stage Konva 600×600; mede o layout real para a validação |
| `components/canvas/LogoSmart.tsx` | Escolhe o logo por audiência (`logos.audienceRule`: interno → Agi, externo → Agibank), fundo e mídia (`logos.usageMap`) e mede a área de proteção (3× pingo verde do "i") |
| `components/canvas/RichText.tsx` | Texto com palavras-chave destacadas (`**Pix**`) e quebra por palavra |
| `components/canvas/CtaPill.tsx` | CTA em pílula sólida com sombra (`ctaRules` "pill-solid-accent") |
| `components/canvas/ShapeCluster.tsx` | Cluster de 3-6 shapes recoloridos, girados e sobrepostos (`shapeClusterPattern`) |
| `components/canvas/IconInline.tsx` | Ícones SVG recoloridos com tokens |
| `lib/svg-utils.ts` | `recolorSvg()`: recolore um SVG (fill ou contorno) e devolve data URL base64 |
| `lib/color-coverage.ts` | Mede a fração de pixels de cada cor da paleta na peça renderizada |
| `components/validation/ValidationPanel.tsx` | Lista ✅/⚠️/❌ e bloqueia o export |
| `lib/brand-tokens.ts` | Camada tipada sobre `assets-map.json` |
| `lib/alerta-spec.ts` | Conteúdo/layout da peça (só referencia chaves do mapa) |
| `lib/contrast-validator.ts` | `validateContrast()` e `validateColorUsage()` |
| `lib/layout-validator.ts` | Nenhum shape/texto dentro da área de proteção do logo |
| `lib/logo-validator.ts` | Família do logo condiz com a audiência dos canais da peça |
| `lib/composition-validator.ts` | Regras de `config/composition-patterns.json`: texto bicolor, CTA de alto contraste, cluster de shapes, escala tipográfica |
| `lib/export-png.ts` | Exporta o Stage como PNG 600×600 |

## Testando o bloqueio

Em `lib/alerta-spec.ts`, faça qualquer uma destas alterações e o painel mostra ❌ blocking, com o botão
"Exportar PNG" desabilitado:

- headline ou corpo em `"azulMedio"`, ou fundo em `"amarelo"`;
- corpo inteiro em `"verde"` (verde sobre azul Agibank só em títulos e palavras-chave);
- remover a `pill` do CTA, ou trocá-la para `"azulEscuro"` (baixo contraste sobre azul Agibank);
- texto branco sobre a pílula verde;
- texto todo numa cor só;
- cluster com menos de 3 shapes, de uma cor só, todo dentro do frame ou cobrindo um texto;
- um shape em cima do logo.
