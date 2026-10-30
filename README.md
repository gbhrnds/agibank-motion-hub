# agibank-motion-hub — Agibank Brand Studio

Hub de marca do Agi. Este repositório contém os assets oficiais (`/assets`), o mapa de tokens
(`/config/assets-map.json`, **única fonte de verdade** de cores, tipografia, paths e regras), os padrões
de composição de peças aprovadas (`/config/composition-patterns.json`, com referências em `/references/popups`) e o
**Brand Studio**: escolha Frente → Subtipo → Formatos na barra lateral, edite o conteúdo (título, texto
de apoio, palavra em destaque, CTA e uma imagem opcional) e gere o desdobramento da peça em todos os
formatos marcados de uma vez, cada um numa prancheta. Em Material Impresso há a opção "Gerar Frente e
Verso" (duas pranchetas por formato), o logo é sempre o arquivo CMYK e o PDF sai em CMYK real.
Em Marca Empregadora, os subtipos são Institucional, Temos Vagas, Eventos e Programas/Formações; os dois
últimos têm o passo "Tema" (`lib/theme-config.ts → temasPorSubtipo`), que traz o logo do programa de
`assets-map.json → programs` (Meetup; Programa de Estágio, versão sem edição). O tema "Meetup" troca o
desdobramento por um carrossel de LinkedIn com
N slides (capa, convidados com foto recortada por um shape real da marca, encerramento), exportado num
PDF de N páginas. Nos outros temas, "LinkedIn Carrossel" é um formato comum (uma prancheta 1080×1080).
Nenhum CTA leva seta por padrão: a seta só entra com "Incluir ícone de seta" marcado.

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
| `lib/theme-config.ts` | `temasPorSubtipo` (tema → `programs.<chave>`) e `temaEvento` (cores como chaves do assets-map, logo Meetup, máscaras e grafismos = shapes gerais de `shapes.byType`) |
| `lib/briefing-parser.ts` / `app/api/parse-briefing` | Importação de redação: extração (.docx/.pdf) e heurística de campos/telas |
| `lib/shape-mask.ts` | Lê o `<path>` de um shape da marca e o encaixa numa caixa com escala única (recorte da foto via `Path2D`) |
| `lib/carousel.ts` | Slides do carrossel (capa / convidado / encerramento), máscara em round-robin, nome do evento estilizado |
| `components/carousel/CarouselPanel.tsx` | Cards de slide editáveis (↑ ↓ ✕, tipo Convidado/Encerramento, "Incluir ícone de seta") e "+ Adicionar Tela" |
| `components/carousel/EventSlideCanvas.tsx` | Slide 1080×1080 do tema Evento |
| `components/carousel/CarouselPreview.tsx` | Slides em sequência horizontal; o PDF segue essa ordem |
| `lib/color-cmyk.ts` | Fonte única de CMYK: tabela das cores da marca, fórmula RGB→CMYK e `convertCanvasToCMYKBuffer()` |
| `components/canvas/PolygonImage.tsx` | Foto recortada por polígono (`clipFunc`), usada pela imagem do Patch 12 e pelos convidados |
| `components/canvas/MaskedImage.tsx` | Imagem enviada recortada (`clipFunc`) por um polígono irregular grande, em metade da peça |
| `lib/image-mask.ts` | Polígonos de máscara, posição da imagem (direita ou topo) e `getCoverFit` (foto cobre 100% da máscara, sem distorcer) |
| `components/canvas/DesignCanvas.tsx` | Stage Konva com `width`/`height` do formato (preview reduzido); mede o layout real |
| `components/canvas/LogoSmart.tsx` | Escolhe o logo por audiência (`logos.audienceRule`: interno → Agi, externo → Agibank), fundo e mídia (`logos.usageMap`) e mede a área de proteção (3× pingo verde do "i") |
| `components/canvas/RichText.tsx` | Texto com palavras-chave destacadas (`**Pix**`) e quebra por palavra |
| `components/canvas/CtaPill.tsx` | CTA nas variantes de `ctaRules`: pílula sólida, pílula outline ou texto com seta |
| `components/canvas/ShapeCluster.tsx` | Desenha os grafismos do layout gerado (shapes recoloridos, escala e rotação) |
| `lib/piece-spec.ts` | `buildLayers(size, …)`: peça escalada do Alerta 600×600 para qualquer formato, com o conteúdo da barra lateral, imagem e lado (frente azul / verso branco) |
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
| `lib/export.ts` | PNG, JPG e PDF no tamanho real do formato (`exportRules`); PDF de várias páginas (carrossel) e PDF CMYK via pdf-lib (impressos) |

## Importar redação

Em todas as frentes, o bloco de conteúdo tem dois modos: "✍️ Desdobrar a partir de KV" (manual, padrão)
e "📄 Importar Redação (arquivo)". O `.docx` (mammoth) ou `.pdf` (pdf-parse) vai para
`app/api/parse-briefing`, que só extrai o texto; `lib/briefing-parser.ts → parseBriefingText` o
interpreta no navegador:

- conteúdo simples: rótulos `Título:`, `Texto:`, `Destaque:`, `CTA:` (ou a ordem das linhas);
- tema Meetup: telas `TELA 01:` (capa: título, data, CTA), `TELA 02…` (convidado: nome, cargo/empresa,
  bio) e a última de encerramento (CTA, link). O tipo também pode vir no cabeçalho (`TELA 03: ENCERRAMENTO`);
- o bloco `LEGENDA:` é sempre descartado.

Os campos aparecem numa tela de revisão editável e só chegam às peças em "Aplicar às Peças". Arquivo fora
do padrão volta ao modo manual com os campos em branco. Na página estática (Artifact) não há servidor:
lá só `.txt` é lido; `.docx`/`.pdf` exigem o app publicado.

## Publicação (Vercel)

O app é um Next.js comum: o Vercel detecta o framework e roda `npm run build` (o `prebuild` gera
`public/assets` e as fontes). Não há `vercel.json` nem variáveis de ambiente obrigatórias — os assets
vêm da CDN pública de `meta.cdnBase`, com a cópia local como reserva. Para publicar:

1. Em vercel.com → **Add New… → Project**, importe o repositório `gbhrnds/agibank-motion-hub` do GitHub.
2. Mantenha o preset **Next.js** e clique em **Deploy**. Cada push na branch de produção (Settings →
   Git → Production Branch) gera um deploy novo; as demais branches geram deploys de preview.

## Validação de marca

As validações (contraste, uso de cor, área de proteção do logo, quebra de linha, grafismo…) rodam em
cada prancheta e aparecem só no console do navegador (`console.warn` "[Validação de marca]"). Elas não
bloqueiam a geração nem a exportação.

## CMYK dos impressos

O PDF de Material Impresso embute a peça como imagem `/DeviceCMYK` (verifique com `pdfimages -list`
ou no Output Preview do Acrobat). Pixels das cores da marca (fundo, shapes, textos, logo) usam a
tabela de `lib/color-cmyk.ts`; o resto (fotos, bordas suavizadas) usa a fórmula padrão
`K = 1 − max(R,G,B)`, `C = (1 − R − K)/(1 − K)`…

O `assets-map.json` ainda não tem os valores CMYK oficiais do brandbook, então hoje a tabela também é
calculada pela fórmula a partir do HEX. Para usar os valores oficiais, adicione ao mapa:

```json
"colorsCmyk": { "azulAgibank": [100, 59, 0, 4], "verde": [47, 0, 71, 13] }
```

(C, M, Y, K de 0 a 100; os números acima são os derivados hoje — troque pelos do brandbook.)
Cada cor declarada ali passa a valer em todo o app.
