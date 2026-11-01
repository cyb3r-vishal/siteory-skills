#!/usr/bin/env node
// Copies the Siteory check engine bundle (siteory-api: npm run build:cli -> dist-cli/siteory.mjs)
// into cli/engine.mjs and every skills/*/scripts/siteory.mjs, so the npm package and each skill
// run the same engine version offline.
//
// Usage: node scripts/vendor-engine.mjs [--from <path to siteory.mjs>]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));

function fail(message) {
  console.error(`vendor-engine: ${message}`);
  process.exit(1);
}

let values;
try {
  ({ values } = parseArgs({ options: { from: { type: "string" } } }));
} catch (error) {
  fail(`${error.message}. Usage: node scripts/vendor-engine.mjs [--from <path>]`);
}
const from = values.from ? resolve(values.from) : join(root, "..", "siteory-api", "dist-cli", "siteory.mjs");

let bundle;
try {
  bundle = readFileSync(from);
} catch (error) {
  fail(`cannot read ${from} (${error.code}). Build it in siteory-api with "npm run build:cli", or pass --from <path>.`);
}

let engine;
try {
  engine = await import(pathToFileURL(from).href);
} catch (error) {
  fail(`cannot import ${from}: ${error.message}`);
}
if (typeof engine.runCli !== "function") fail(`${from} does not export runCli(argv), so it is not the Siteory engine bundle.`);

const skillsDir = join(root, "skills");
const targets = [
  join(root, "cli", "engine.mjs"),
  ...readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsDir, entry.name, "scripts", "siteory.mjs")),
];
// The bundle was read into memory first, so --from may even point at one of the targets.
for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bundle);
}

console.log(`Vendored engine ${engine.VERSION ?? "(no VERSION export)"} (${bundle.length} bytes) from ${from} into:`);
for (const target of targets) console.log(`  ${relative(root, target)}`);
