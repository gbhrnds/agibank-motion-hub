/**
 * Quebra de linha sem viúvas tipográficas
 * (composition-patterns.json → typographyLineBreakRules): artigos, preposições e conjunções
 * curtas nunca terminam uma linha — vão para o início da linha seguinte.
 */

/** Minúsculas e sem pontuação ("E," → "e"); mantém acentos ("à", "é"). */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isForbidden(word: string, forbidden: Set<string>): boolean {
  return forbidden.has(normalizeWord(word));
}

/**
 * Corrige linhas já quebradas: se a última palavra de uma linha (exceto a última) for proibida,
 * move-a para o início da linha seguinte e repete, pois a mudança pode criar nova viúva na
 * mesma linha. Aceita o texto com "\n" entre linhas ou o array de linhas.
 */
export function preventWidows(text: string | string[], forbiddenWords: string[]): string[] {
  const lines = (Array.isArray(text) ? text : text.split("\n")).map((l) => l.split(/\s+/).filter(Boolean));
  return fixWidows(lines, (w) => w, new Set(forbiddenWords.map(normalizeWord))).map((l) => l.join(" "));
}

/**
 * Núcleo genérico do algoritmo, sobre linhas de itens quaisquer.
 * `reflow` recebe as linhas e o índice a partir do qual refazer a quebra (a linha que ganhou
 * uma palavra pode ter estourado a largura).
 */
export function fixWidows<T>(
  input: T[][],
  wordOf: (item: T) => string,
  forbidden: Set<string>,
  reflow?: (lines: T[][], from: number) => T[][],
): T[][] {
  let lines = input.map((l) => [...l]);
  let i = 0;
  while (i < lines.length - 1) {
    const line = lines[i];
    // Uma linha nunca fica vazia: se só resta a palavra proibida, ela fica.
    if (line.length > 1 && isForbidden(wordOf(line[line.length - 1]), forbidden)) {
      lines[i + 1].unshift(line.pop()!);
      if (reflow) lines = reflow(lines, i + 1);
      continue;
    }
    i++;
  }
  return lines;
}

export interface WrapOptions<T> {
  maxWidth: number;
  widthOf: (item: T) => number;
  /** Largura do espaço antes do item quando ele não abre a linha. */
  spaceBefore: (item: T) => number;
  wordOf: (item: T) => string;
  forbiddenWords: string[];
}

/** Quebra gulosa por largura + correção de viúvas, refazendo a quebra quando uma palavra desce. */
export function wrapWords<T>(items: T[], opts: WrapOptions<T>): T[][] {
  const greedy = (list: T[]): T[][] => {
    const lines: T[][] = [];
    let current: T[] = [];
    let width = 0;
    for (const item of list) {
      const w = opts.widthOf(item);
      const add = current.length ? opts.spaceBefore(item) + w : w;
      if (current.length && width + add > opts.maxWidth) {
        lines.push(current);
        current = [item];
        width = w;
      } else {
        current.push(item);
        width += add;
      }
    }
    if (current.length) lines.push(current);
    return lines;
  };
  const forbidden = new Set(opts.forbiddenWords.map(normalizeWord));
  return fixWidows(greedy(items), opts.wordOf, forbidden, (lines, from) => [
    ...lines.slice(0, from),
    ...greedy(lines.slice(from).flat()),
  ]);
}

/**
 * Pipeline completo para texto simples: quebra pela largura (medida por `measure`), aplica a regra
 * de viúvas e devolve a string com "\n" explícitos — pronta para o Konva.Text, sem depender do
 * wrap automático dele.
 */
export function breakIntoLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  forbiddenWords: string[],
): string {
  const words = text.split(/\s+/).filter(Boolean);
  const space = measure(" ");
  return wrapWords(words, { maxWidth, widthOf: measure, spaceBefore: () => space, wordOf: (w) => w, forbiddenWords })
    .map((line) => line.join(" "))
    .join("\n");
}
