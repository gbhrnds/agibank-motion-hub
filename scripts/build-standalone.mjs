// Gera uma versão estática do app em dist-standalone/ (HTML + app.js + assets usados),
// para abrir sem servidor Next.js. Uso: npm run build:standalone
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-standalone");
const map = JSON.parse(readFileSync(join(root, "config/assets-map.json"), "utf8"));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, "scripts/standalone/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  jsx: "automatic",
  outfile: join(out, "app.js"),
  tsconfig: join(root, "tsconfig.json"),
  alias: {
    "next/dynamic": join(root, "scripts/standalone/next-dynamic.tsx"),
    "@/lib/export-png": join(root, "scripts/standalone/export-png.ts"),
    canvas: join(root, "scripts/standalone/empty.js"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_ASSET_BASE": '"./"',
  },
  logLevel: "warning",
});

// Fontes embutidas como data URI; SVGs publicados ao lado da página (carregados via fetch).
const { fontFamily, basePath, format, weights } = map.typography;
const faces = Object.values(weights)
  .map(({ file, value }) => {
    const b64 = readFileSync(join(root, basePath, file)).toString("base64");
    return `@font-face{font-family:"${fontFamily}";src:url(data:font/${format};base64,${b64}) format("${format}");font-weight:${value};font-style:normal;font-display:block}`;
  })
  .join("\n");
const twInput = join(out, "tw-input.css");
writeFileSync(twInput, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
const tw = execFileSync("npx", ["tailwindcss", "-c", join(root, "tailwind.config.ts"), "-i", twInput, "--minify"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
rmSync(twInput);

const css = readFileSync(join(root, "scripts/standalone/page.css"), "utf8");
const html = readFileSync(join(root, "scripts/standalone/index.html"), "utf8")
  .replace("/*FONTS*/", faces)
  .replace("/*TAILWIND*/", tw)
  .replace("/*PAGE*/", css);
writeFileSync(join(out, "index.html"), html);

const used = [
  ...Object.values(map.logos.files).map((f) => join(map.logos.basePath, f)),
  ...Object.values(map.shapes.byType).flat().map((f) => join(map.shapes.basePath, f)),
  ...Object.values(map.icons.categories).flat().map((f) => join(map.icons.basePath, f)),
];
for (const rel of used) cpSync(join(root, rel), join(out, rel));
console.log(`[build-standalone] dist-standalone/ pronto (${used.length} SVGs)`);
