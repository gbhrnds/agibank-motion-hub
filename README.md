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

Testes (quebra de linha, viúvas e motor de layout): `npm test`.

`npm run dev` / `npm run build` executam antes `scripts/sync-assets.mjs`, que:

- copia `/assets` → `/public/assets` (o Next.js só serve estáticos de `/public`);
- gera `app/fonts.generated.css` com os `@font-face` a partir de `typography.weights` do `assets-map.json`
  (importado por `app/globals.css`).

Ambos os arquivos gerados estão no `.gitignore`.

## Estrutura

| Caminho | Papel |
| --- | --- |
| `app/page.tsx` | Ferramenta em tela dividida: barra lateral (logo, "Gerar Nova Composição", estado da peça, validação, exportação) e prancheta com o canvas |
| `components/canvas/AlertaCanvas.tsx` | Stage Konva 600×600; mede o layout real para a validação |
| `components/canvas/LogoSmart.tsx` | Escolhe o logo por audiência (`logos.audienceRule`: interno → Agi, externo → Agibank), fundo e mídia (`logos.usageMap`) e mede a área de proteção (3× pingo verde do "i") |
| `components/canvas/RichText.tsx` | Texto com palavras-chave destacadas (`**Pix**`) e quebra por palavra |
| `components/canvas/CtaPill.tsx` | CTA nas variantes de `ctaRules`: pílula sólida, pílula outline ou texto com seta |
| `components/canvas/ShapeCluster.tsx` | Desenha os grafismos do layout gerado (shapes recoloridos, escala e rotação) |
| `lib/layout-engine.ts` | `generateRandomLayout()`: sorteia alinhamento, estilo de CTA, arquétipo de shapes e paleta (`composition-patterns.json`) e posiciona os shapes sem tocar textos, CTA e logo |
| `lib/piece-style.ts` | Aplica alinhamento (texto, CTA, logo) e variante do CTA às camadas da peça |
| `lib/shape-silhouette.ts` | Silhueta real de cada SVG para testar colisão, sobreposição e vão entre shapes |
| `lib/keep-out.ts` | Áreas que os grafismos não podem tocar (textos, CTA, área de proteção do logo), medidas ou previstas por alinhamento |
| `lib/text-wrap.ts` | `preventWidows()` / `wrapWords()` / `breakIntoLines()`: quebra com `\n` explícito e sem viúvas (`typographyLineBreakRules`) |
| `components/canvas/IconInline.tsx` | Ícones SVG recoloridos com tokens |
| `lib/svg-utils.ts` | `recolorSvg()`: recolore um SVG (fill ou contorno) e devolve data URL base64 |
| `lib/color-coverage.ts` | Mede a fração de pixels de cada cor da paleta na peça renderizada |
| `components/validation/ValidationPanel.tsx` | Cards ✅/⚠️/❌ da validação de marca (bloqueios primeiro) |
| `lib/brand-tokens.ts` | Camada tipada sobre `assets-map.json` |
| `lib/alerta-spec.ts` | Conteúdo/layout da peça (só referencia chaves do mapa) |
| `lib/contrast-validator.ts` | `validateContrast()` e `validateColorUsage()` |
| `lib/layout-validator.ts` | Nenhum shape/texto dentro da área de proteção do logo |
| `lib/logo-validator.ts` | Família do logo condiz com a audiência dos canais da peça |
| `lib/composition-validator.ts` | Regras de `config/composition-patterns.json`: variante do CTA, grafismo gerado (arquétipo, hierarquia de escala, paleta fechada) e, do `assets-map.json`, texto bicolor e quebra sem viúvas |
| `lib/export.ts` | Exporta PNG, JPG e PDF conforme `assets-map.json → exportRules` |

## Testando o bloqueio

Em `lib/alerta-spec.ts`, faça qualquer uma destas alterações e o painel mostra ❌ blocking, com os
botões de exportação (PNG, JPG, PDF) desabilitados:

- headline ou corpo em `"azulMedio"`, ou fundo em `"amarelo"`;
- corpo inteiro em `"verde"` (verde sobre azul Agibank só em títulos e palavras-chave);
- texto branco sobre a pílula verde;
- texto todo numa cor só;
- um shape em cima do logo.
