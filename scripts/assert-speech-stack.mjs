import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set(["node_modules", ".next", ".git", "agent/node_modules"]);

async function walk(dir, found) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, found);
      continue;
    }
    if (entry.name === "assert-speech-stack.mjs") continue;
    if (!/\.(json|ts|tsx|mjs|js|md|sql|example)$/.test(entry.name)) continue;
    const text = await readFile(full, "utf8");
    if (/@deepgram|DEEPGRAM_|deepgram-sdk/i.test(text)) found.push(full);
  }
}

const found = [];
await walk(root, found);
if (found.length) {
  console.error("Speech stack must not include Deepgram:");
  for (const file of found) console.error(`  - ${file}`);
  process.exit(1);
}
console.log("[speech] Cartesia/OpenAI stack check passed");
