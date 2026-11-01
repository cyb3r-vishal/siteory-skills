#!/usr/bin/env node
// Checks each skill against the part of the Agent Skills spec that every client accepts:
// portable frontmatter only, name equal to the directory, description length, no BOM or CR
// in text files, a body under 400 lines, and no missing or unlinked reference files.
//
// Usage: node scripts/validate-skills.mjs [skills dir]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../cli/skills.mjs";

const ALLOWED_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEXT_FILE = /\.(?:md|txt|ya?ml|json|mjs|js)$/;
const MAX_BODY_LINES = 400;

function validateSkill(dir) {
  const errors = [];
  const skillFile = join(dir, "SKILL.md");
  if (!existsSync(skillFile)) return ["SKILL.md is missing."];

  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)).replaceAll("\\", "/"));
  for (const file of files.filter((path) => TEXT_FILE.test(path))) {
    const bytes = readFileSync(join(dir, file));
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) errors.push(`${file} starts with a UTF-8 BOM.`);
    if (bytes.includes(0x0d)) errors.push(`${file} has CR characters; use LF line endings.`);
  }

  let parsed;
  try {
    parsed = parseFrontmatter(readFileSync(skillFile, "utf8"));
  } catch (error) {
    return [...errors, `SKILL.md: ${error.message}`];
  }
  const { data, body } = parsed;
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`SKILL.md: field "${key}" is not portable; use only ${[...ALLOWED_FIELDS].join(", ")}.`);
  }
  const name = data.name;
  if (typeof name !== "string" || !NAME.test(name) || name.length > 64) {
    errors.push("SKILL.md: name must be 1-64 lowercase letters, digits and single hyphens.");
  } else if (name !== basename(dir)) {
    errors.push(`SKILL.md: name "${name}" must equal the directory name "${basename(dir)}".`);
  }
  if (typeof data.description !== "string" || data.description.length === 0 || data.description.length > 1024) {
    errors.push(`SKILL.md: description must be 1-1024 characters (has ${String(data.description ?? "").length}).`);
  }
  if (data.license !== undefined && typeof data.license !== "string") errors.push("SKILL.md: license must be a string.");
  if (data.compatibility !== undefined && (typeof data.compatibility !== "string" || data.compatibility.length > 500)) {
    errors.push("SKILL.md: compatibility must be a string of at most 500 characters.");
  }
  if (data.metadata !== undefined && (typeof data.metadata !== "object" || Object.values(data.metadata).some((value) => typeof value !== "string"))) {
    errors.push("SKILL.md: metadata must map keys to strings.");
  }
  const bodyLines = body.split("\n").length;
  if (bodyLines >= MAX_BODY_LINES) errors.push(`SKILL.md: body has ${bodyLines} lines; keep it under ${MAX_BODY_LINES} and move detail to references/.`);

  // Skill-relative paths only: "src/scripts/x.js" in an example is not a mention of scripts/.
  const mentioned = new Set(body.match(/(?<![\w/.-])(?:references|templates|scripts|agents)\/[\w./-]*[\w-]/g) ?? []);
  for (const path of mentioned) {
    if (!existsSync(join(dir, path))) errors.push(`SKILL.md mentions ${path}, which does not exist.`);
  }
  for (const file of files.filter((path) => /^(?:references|templates)\//.test(path))) {
    if (!mentioned.has(file)) errors.push(`${file} is never mentioned in SKILL.md, so agents will not find it.`);
  }
  return errors;
}

const skillsDir = resolve(process.argv[2] ?? fileURLToPath(new URL("../skills/", import.meta.url)));
const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(skillsDir, entry.name));
let failed = 0;
for (const dir of dirs) {
  const errors = validateSkill(dir);
  if (errors.length === 0) continue;
  failed += 1;
  for (const error of errors) console.error(`${basename(dir)}: ${error}`);
}
if (failed > 0) {
  console.error(`${failed} of ${dirs.length} skills failed validation.`);
  process.exit(1);
}
console.log(`${dirs.length} skills passed validation.`);
