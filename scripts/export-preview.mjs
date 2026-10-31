import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [url, outputArg, ...extra] = process.argv.slice(2);

if (!url || !outputArg || extra.length > 0) {
  console.error("Usage: node scripts/export-preview.mjs <local-url> <output-path>");
  process.exit(2);
}

const parsedUrl = new URL(url);
if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
  console.error("The source URL must use HTTP or HTTPS.");
  process.exit(2);
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(outputArg);
const relativeOutput = path.relative(repositoryRoot, outputPath);
if (
  relativeOutput === "" ||
  (!relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== ".." && !path.isAbsolute(relativeOutput))
) {
  console.error("Choose an output path outside the repository.");
  process.exit(2);
}

const response = await fetch(parsedUrl);
if (!response.ok) {
  console.error(`Request failed with HTTP ${response.status}.`);
  process.exit(1);
}

const html = await response.text();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Saved HTTP ${response.status} response to ${outputPath} (${Buffer.byteLength(html)} bytes).`);
