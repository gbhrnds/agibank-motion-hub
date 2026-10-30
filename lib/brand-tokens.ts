import assetsMap from "@/config/assets-map.json";

/**
 * Camada tipada sobre config/assets-map.json — a única fonte de verdade para
 * cores, tipografia, paths de assets e regras de marca. Nenhum outro módulo
 * deve declarar hex, famílias de fonte ou caminhos de arquivo.
 */

export type ColorKey = keyof typeof assetsMap.colors;
export type FontWeightKey = keyof typeof assetsMap.typography.weights;
export type LogoKey = keyof typeof assetsMap.logos.files;
/** Audiências de logos.audienceRule ("interno" | "externo"). */
export type Audience = keyof typeof assetsMap.logos.audienceRule;
/** Nome de arquivo listado em icons.categories (validado em runtime por iconPath). */
export type IconFile = string;
/** Nome de arquivo listado em shapes.byType (validado em runtime por shapePath). */
export type ShapeFile = string;

export interface ContrastRule {
  preferido: ColorKey[];
  /** Cores liberadas só para destaque (títulos e palavras-chave), não para texto corrido. */
  destaque?: ColorKey[];
  obrigatorio?: boolean;
}

export interface BrandRules {
  contrastMap: Partial<Record<ColorKey, ContrastRule>>;
  colorUsage: Partial<Record<ColorKey, string>>;
  textHierarchy?: string;
}

export interface ClearSpaceRule {
  multiplier: number;
  reference: string;
}

export const brandTokens = assetsMap;
export const colors: Record<ColorKey, string> = assetsMap.colors;
export const brandRules = assetsMap.brandRules as BrandRules;
export const logoClearSpace: ClearSpaceRule = assetsMap.logos.clearSpace;

export type EffectKey = keyof typeof assetsMap.effects;
export interface ShadowEffect {
  color: string;
  blur: number;
  opacity: number;
  offsetY: number;
}
export function effect(key: EffectKey): ShadowEffect {
  return assetsMap.effects[key];
}

export const fontFamily = assetsMap.typography.fontFamily;
export const fontFallback = assetsMap.typography.fallback;
/** font-family pronto para CSS/Konva, com fallback. */
export const fontStack = `"${fontFamily}", ${fontFallback}`;

export function color(key: ColorKey): string {
  return colors[key];
}

export function fontWeight(key: FontWeightKey): number {
  return assetsMap.typography.weights[key].value;
}

/** Valor de `font` CSS (usado por document.fonts.load). */
export function fontShorthand(weight: FontWeightKey, sizePx: number): string {
  return `${fontWeight(weight)} ${sizePx}px ${fontStack}`;
}

export const allFontWeights = Object.keys(assetsMap.typography.weights) as FontWeightKey[];

// Paths — servidos a partir de /public/assets (ver scripts/sync-assets.mjs).
// O build estático (scripts/build-standalone.mjs) troca a base por "./".
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "/";
const url = (basePath: string, file: string) => `${ASSET_BASE}${basePath}${file}`;

export function logoPath(key: LogoKey): string {
  return url(assetsMap.logos.basePath, assetsMap.logos.files[key]);
}

const knownIcons = new Set<string>(Object.values(assetsMap.icons.categories).flat());
const knownShapes = new Set<string>(Object.values(assetsMap.shapes.byType).flat());

export function iconPath(file: IconFile): string {
  if (!knownIcons.has(file)) throw new Error(`Ícone "${file}" não existe em assets-map.json → icons.categories`);
  return url(assetsMap.icons.basePath, file);
}

export function shapePath(file: ShapeFile): string {
  if (!knownShapes.has(file)) throw new Error(`Shape "${file}" não existe em assets-map.json → shapes.byType`);
  return url(assetsMap.shapes.basePath, file);
}

/**
 * Escolhe a chave do logo em logos.files:
 * - família pela audiência (logos.audienceRule: interno → "agi", externo → "agibank");
 * - variante pelo fundo (logos.usageMap: fundo azul → negative, fundo branco → positive);
 * - perfil de cor pela mídia (logos.usageMap: digital → rgb, impresso → cmyk).
 */
export function pickLogoKey(
  audience: Audience,
  fundo: "fundoAzul" | "fundoBranco",
  midia: "digital" | "impresso",
): LogoKey {
  const family = assetsMap.logos.audienceRule[audience].logoFamily;
  const variant = assetsMap.logos.usageMap[fundo];
  const profile = assetsMap.logos.usageMap[midia];
  const key = `${family}${capitalize(variant)}${capitalize(profile)}`;
  if (!(key in assetsMap.logos.files)) {
    throw new Error(`Logo "${key}" não existe em assets-map.json → logos.files`);
  }
  return key as LogoKey;
}

/** Audiência em cujo logos.audienceRule.<audiencia>.exemplos o canal aparece (ex.: "alerta-sj" → "interno"). */
export function audienceForChannel(channel: string): Audience | undefined {
  const rules = assetsMap.logos.audienceRule as Record<Audience, { exemplos: string[] }>;
  return (Object.keys(rules) as Audience[]).find((a) => rules[a].exemplos.includes(channel));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
