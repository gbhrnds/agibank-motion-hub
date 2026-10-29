# agibank-motion-hub — Agibank Brand Studio

Hub de marca do Agi. Este repositório contém os assets oficiais (`/assets`), o mapa de tokens
(`/config/assets-map.json`, **única fonte de verdade** de cores, tipografia, paths e regras) e o
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
| `components/canvas/ShapeDecor.tsx` / `IconInline.tsx` | Shapes e ícones SVG recoloridos com tokens |
| `components/validation/ValidationPanel.tsx` | Lista ✅/⚠️/❌ e bloqueia o export |
| `lib/brand-tokens.ts` | Camada tipada sobre `assets-map.json` |
| `lib/alerta-spec.ts` | Conteúdo/layout da peça (só referencia chaves do mapa) |
| `lib/contrast-validator.ts` | `validateContrast()` e `validateColorUsage()` |
| `lib/layout-validator.ts` | Nenhum shape/texto dentro da área de proteção do logo |
| `lib/logo-validator.ts` | Família do logo condiz com a audiência dos canais da peça |
| `lib/export-png.ts` | Exporta o Stage como PNG 600×600 |

## Testando o bloqueio

Em `lib/alerta-spec.ts`, troque o `color` de qualquer camada de texto para `"azulMedio"` (ou o fundo
para `"amarelo"`, ou mova um shape para cima do logo): o painel mostra ❌ blocking e o botão
"Exportar PNG" é desabilitado.
