// Replica /assets em /public/assets (Next.js só serve estáticos de /public)
// e gera app/fonts.generated.css a partir de config/assets-map.json.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(readFileSync(join(root, "config/assets-map.json"), "utf8"));

const publicAssets = join(root, "public/assets");
rmSync(publicAssets, { recursive: true, force: true });
cpSync(join(root, "assets"), publicAssets, { recursive: true });

const { fontFamily, basePath, format, weights } = map.typography;
const faces = Object.values(weights)
  .map(
    ({ file, value }) => `@font-face {
  font-family: "${fontFamily}";
  src: url("/${basePath}${file}") format("${format}");
  font-weight: ${value};
  font-style: normal;
  font-display: block;
}`,
  )
  .join("\n\n");

writeFileSync(
  join(root, "app/fonts.generated.css"),
  `/* Gerado por scripts/sync-assets.mjs a partir de config/assets-map.json — não editar. */\n\n${faces}\n`,
);

console.log(`[sync-assets] /assets -> /public/assets, ${Object.keys(weights).length} @font-face gerados`);
