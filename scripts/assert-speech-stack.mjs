import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const banned = ["deep", "gram"].join("");
const skip = new Set(["node_modules", ".next", ".git", "coverage", "out", "dist"]);

async function walk(dir, found) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, found);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs|json|sql|css|md|toml|yml|yaml)$/.test(entry.name)) continue;
    if (full.endsWith(`${path.sep}scripts${path.sep}assert-speech-stack.mjs`)) continue;
    const text = await readFile(full, "utf8");
    if (text.toLowerCase().includes(banned)) found.push(path.relative(root, full));
  }
}

const found = [];
await walk(root, found);
if (found.length) {
  console.error(`Remove ${banned} references from:`);
  for (const file of found) console.error(`  - ${file}`);
  process.exit(1);
}
console.log("Speech stack check passed.");
