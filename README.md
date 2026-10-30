# agibank-motion-hub — Agibank Brand Studio

Hub de marca do Agi. Este repositório contém os assets oficiais (`/assets`), o mapa de tokens
(`/config/assets-map.json`, **única fonte de verdade** de cores, tipografia, paths e regras), os padrões
de composição de peças aprovadas (`/config/composition-patterns.json`, com referências em `/references/popups`) e o
**Brand Studio**: escolha Frente → Subtipo → Formatos na barra lateral e gere o desdobramento da peça
(Alerta institucional) em todos os formatos marcados de uma vez, cada um numa prancheta.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

Testes (quebra de linha, viúvas e motor de layout): `npm test`.

`npm run dev` / `npm run build` executam antes `scripts/sync-assets.mjs`, que:

- copia `/assets` → `/public/assets` (cópia local, usada só se a CDN falhar);
- gera `app/fonts.generated.css` com os `@font-face` a partir de `typography.weights` do `assets-map.json`
  (importado por `app/globals.css`): CDN primeiro, cópia local como fallback.

Todos os assets (SVGs, logos, fontes) são carregados da CDN pública em `assets-map.json → meta.cdnBase`
(`lib/asset-fetch.ts`); se a CDN não responder, o app usa a cópia local.

Ambos os arquivos gerados estão no `.gitignore`.

## Estrutura

| Caminho | Papel |
| --- | --- |
| `app/page.tsx` | Barra lateral em cascata (Frente → Subtipo → Formatos, botão "Gerar desdobramento") e área de preview com uma prancheta por formato |
| `lib/format-config.ts` | `MENU_CONFIG` (frentes, subtipos, formatos com largura/altura) e o contexto de marca de cada frente (audiência e mídia do logo) |
| `components/canvas/FormatArtboard.tsx` | Prancheta de um formato: compõe a peça, gera os shapes, valida (só no console) e exporta PNG/JPG/PDF |
| `components/canvas/DesignCanvas.tsx` | Stage Konva com `width`/`height` do formato (preview reduzido); mede o layout real |
| `components/canvas/LogoSmart.tsx` | Escolhe o logo por audiência (`logos.audienceRule`: interno → Agi, externo → Agibank), fundo e mídia (`logos.usageMap`) e mede a área de proteção (3× pingo verde do "i") |
| `components/canvas/RichText.tsx` | Texto com palavras-chave destacadas (`**Pix**`) e quebra por palavra |
| `components/canvas/CtaPill.tsx` | CTA nas variantes de `ctaRules`: pílula sólida, pílula outline ou texto com seta |
| `components/canvas/ShapeCluster.tsx` | Desenha os grafismos do layout gerado (shapes recoloridos, escala e rotação) |
| `lib/piece-spec.ts` | `buildLayers(size, …)`: peça base escalada do Alerta 600×600 para qualquer formato |
| `lib/piece-style.ts` | Aplica alinhamento e variante do CTA e empilha headline/corpo/CTA na vertical (`composeLayers`) |
| `lib/layout-engine.ts` | `pickPieceRun()` sorteia o estado global do desdobramento; `generateRandomLayout()` posiciona os shapes em cada formato sem tocar textos, CTA e logo |
| `lib/shape-silhouette.ts` | Silhueta real de cada SVG para testar colisão, sobreposição e vão entre shapes |
| `lib/keep-out.ts` | Áreas que os grafismos não podem tocar (textos, CTA, área de proteção do logo), medidas ou previstas |
| `lib/text-wrap.ts` | `preventWidows()` / `wrapWords()` / `breakIntoLines()`: quebra com `\n` explícito e sem viúvas |
| `components/canvas/IconInline.tsx` | Ícones SVG recoloridos com tokens |
| `lib/svg-utils.ts` | `recolorSvg()`: baixa o SVG da CDN, recolore (fill ou contorno) e devolve data URL base64 |
| `lib/asset-fetch.ts` | Busca na CDN (`meta.cdnBase`) com fallback para a cópia local |
| `lib/color-coverage.ts` | Mede a fração de pixels de cada cor da paleta na peça renderizada |
| `lib/brand-tokens.ts` | Camada tipada sobre `assets-map.json` (URLs de assets na CDN) |
| `lib/contrast-validator.ts` | `validateContrast()` e `validateColorUsage()` |
| `lib/layout-validator.ts` | Nenhum shape/texto dentro da área de proteção do logo |
| `lib/logo-validator.ts` | Família do logo condiz com a audiência dos canais da peça |
| `lib/composition-validator.ts` | Regras de `config/composition-patterns.json` e quebra sem viúvas |
| `lib/export.ts` | Exporta PNG, JPG e PDF no tamanho real do formato, conforme `assets-map.json → exportRules` |

## Validação de marca

As validações (contraste, uso de cor, área de proteção do logo, quebra de linha, grafismo…) rodam em
cada prancheta e aparecem só no console do navegador (`console.warn` "[Validação de marca]"). Elas não
bloqueiam a geração nem a exportação.
