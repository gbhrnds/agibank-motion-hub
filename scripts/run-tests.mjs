// Compila tests/*.test.ts com esbuild e roda com o test runner nativo do Node.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "node_modules/.cache/tests");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const entries = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.ts"));
await build({
  entryPoints: entries.map((f) => join(root, "tests", f)),
  outdir: out,
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  packages: "external",
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "warning",
});

const files = entries.map((f) => join(out, f.replace(/\.ts$/, ".mjs")));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
